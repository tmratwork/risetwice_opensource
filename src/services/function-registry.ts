export interface FunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, FunctionParameter>;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface FunctionResult {
  name: string;
  result: Record<string, unknown>;
}

type FunctionHandler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

export class FunctionRegistry {
  private functions: Map<string, {
    definition: FunctionDefinition;
    handler: FunctionHandler;
  }> = new Map();
  
  public registerFunction(
    definition: FunctionDefinition,
    handler: FunctionHandler
  ): void {
    this.functions.set(definition.name, { definition, handler });
  }
  
  public getFunctionDefinitions(): FunctionDefinition[] {
    return Array.from(this.functions.values()).map(fn => fn.definition);
  }
  
  public async executeFunction(call: FunctionCall): Promise<FunctionResult> {
    const fn = this.functions.get(call.name);
    
    if (!fn) {
      throw new Error(`Function "${call.name}" not found`);
    }
    
    try {
      const result = await fn.handler(call.arguments);
      return {
        name: call.name,
        result
      };
    } catch (error) {
      console.error(`Error executing function "${call.name}":`, error);
      throw error;
    }
  }
}

export const functionRegistry = new FunctionRegistry();