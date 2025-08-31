import { FunctionRegistry } from './function-registry';
import { MODELS } from '@/config/models';

interface AITool {
    type: string;
    function?: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
        input_schema?: {
            type: 'object';
            properties?: Record<string, unknown>;
            required?: string[];
            [k: string]: unknown;
        };
    };
}

interface AIAgentConfig {
    instructions: string;
    greetingInstructions?: string;
    tools: AITool[];
    tool_choice: string | { function: { name: string } };
    voice?: string;
}

export class AgoraAIService {
    private appId: string;
    private customerId: string;
    private customerSecret: string;
    private functionRegistry: FunctionRegistry;

    constructor(
        appId: string,
        customerId: string,
        customerSecret: string,
        functionRegistry: FunctionRegistry
    ) {
        this.appId = appId;
        this.customerId = customerId;
        this.customerSecret = customerSecret;
        this.functionRegistry = functionRegistry;
    }

    private getAuthHeader(): string {
        return `Basic ${Buffer.from(
            `${this.customerId}:${this.customerSecret}`
        ).toString('base64')}`;
    }

    public async startAgent(
        channelName: string,
        token: string,
        agentUid: number,
        config: AIAgentConfig
    ): Promise<string> {
        const response = await fetch(
            `https://api.agora.io/conversational-ai-agent/v2/projects/${this.appId}/join`,
            {
                method: 'POST',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `ai-agent-${Date.now()}`,
                    properties: {
                        channel: channelName,
                        token: token,
                        agent_rtc_uid: agentUid,
                        remote_rtc_uids: ["*"],
                        enable_string_uid: false,
                        idle_timeout: 300, // 5 minutes
                        llm: {
                            url: "https://api.openai.com/v1/chat/completions",
                            api_key: process.env.OPENAI_API_KEY,
                            system_messages: [
                                {
                                    role: "system",
                                    content: config.instructions
                                }
                            ],
                            greeting_message: config.greetingInstructions || "Hello, how can I help you today?",
                            failure_message: "I'm sorry, I couldn't process that request.",
                            max_history: 10,
                            params: {
                                model: MODELS.OPENAI.GPT_4O,
                                tools: config.tools.map(toolObj => {
                                    if (toolObj.type === 'function' && toolObj.function) {
                                        const fn = toolObj.function;
                                        return {
                                            type: "function",
                                            function: {
                                                name: fn.name,
                                                description: fn.description,
                                                parameters: fn.parameters,
                                                input_schema: fn.input_schema || {
                                                    type: 'object',
                                                    properties: fn.parameters,
                                                    required: Object.entries(fn.parameters as Record<string, { required?: boolean }>)
                                                        .filter(([, param]) => param.required)
                                                        .map(([name]) => name)
                                                }
                                            }
                                        };
                                    }
                                    return toolObj;
                                }),
                                tool_choice: config.tool_choice
                            }
                        },
                        asr: {
                            language: "en-US"
                        },
                        tts: {
                            vendor: "microsoft",
                            params: {
                                key: process.env.AZURE_TTS_KEY || process.env.MS_TTS_KEY,
                                region: "eastus",
                                voice_name: config.voice || "en-US-AriaNeural"
                            }
                        },
                        webhook: {
                            function_call: {
                                url: `${process.env.API_BASE_URL}/api/v12/function-call`,
                                headers: {
                                    "X-API-Key": process.env.WEBHOOK_API_KEY
                                }
                            }
                        }
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to start AI agent: ${response.status}, ${errorText}`);
        }

        const data = await response.json();
        return data.agent_id;
    }

    public async stopAgent(agentId: string): Promise<void> {
        const response = await fetch(
            `https://api.agora.io/conversational-ai-agent/v2/projects/${this.appId}/agents/${agentId}/leave`,
            {
                method: 'POST',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json',
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to stop AI agent: ${response.status}, ${errorText}`);
        }
    }

    public async sendMessage(channelName: string, agentId: string, message: string): Promise<void> {
        const response = await fetch(
            `https://api.agora.io/conversational-ai-agent/v2/projects/${this.appId}/agents/${agentId}/send`,
            {
                method: 'POST',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: {
                        role: "user",
                        content: message
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send message to AI agent: ${response.status}, ${errorText}`);
        }
    }
}