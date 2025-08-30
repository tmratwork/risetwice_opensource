import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - RiseTwice',
  description: 'RiseTwice privacy policy - how we protect and handle your personal information in our AI mental health companion app.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">RiseTwice Privacy Policy</h1>

          <div className="text-gray-700 mb-6">
            <p><strong>Effective Date:</strong> 2025 01 01</p>
            <p><strong>Last Updated:</strong> 2025 08 28</p>
          </div>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Commitment to Your Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              At RiseTwice, we understand that privacy is especially important when you&apos;re seeking mental health support. This Privacy Policy explains how we collect, use, protect, and share your information when you use our AI companion app. We are committed to maintaining the highest standards of privacy and security for our users.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              <strong>Important:</strong> RiseTwice is a 501(c)(3) nonprofit organization. We do not sell your personal information to third parties, and we are not driven by profit motives.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Conversations with Our AI</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Voice recordings:</strong> We temporarily process voice recordings to convert them to text for our AI to understand</li>
                <li><strong>Text conversations:</strong> We store conversation history to maintain context and improve your experience</li>
                <li><strong>Response patterns:</strong> We may analyze conversation patterns to improve our AI&apos;s ability to provide support</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Account Information</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Basic profile:</strong> Username, age range, and basic demographics (optional)</li>
                <li><strong>Account settings:</strong> Your preferences and app customization choices</li>
                <li><strong>Authentication data:</strong> Information needed to verify your identity and secure your account</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Usage Information</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>App activity:</strong> How you use different features and which resources you access</li>
                <li><strong>Device information:</strong> Device type, operating system, app version</li>
                <li><strong>Performance data:</strong> Crash reports and technical issues to improve app stability</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Location Information (Optional)</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Approximate location:</strong> Used only to find nearby resources like crisis centers, food banks, and shelters</li>
                <li><strong>We do not track or store precise location data</strong></li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Crisis Intervention Data</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Emergency contacts:</strong> If you provide them for crisis situations</li>
                <li><strong>Professional referrals:</strong> Information about healthcare providers you choose to connect with</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Providing Support</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Deliver personalized AI responses based on trauma-informed principles</li>
                <li>Maintain conversation context to provide coherent, helpful interactions</li>
                <li>Connect you with appropriate local resources and crisis support</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Safety and Crisis Intervention</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Identify when you may need immediate professional help</li>
                <li>Escalate to human support when our AI detects crisis situations</li>
                <li>Facilitate connections with licensed professionals when requested</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Service Improvement</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Improve our AI&apos;s responses through analysis of conversation patterns</li>
                <li>Develop new features based on user needs and feedback</li>
                <li>Enhance our trauma-informed care approaches</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Legal and Safety Requirements</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Comply with applicable laws and regulations</li>
                <li>Protect against fraud, abuse, or harmful activities</li>
                <li>Respond to legal requests when required by law</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Protect Your Information</h2>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Technical Safeguards</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Encryption:</strong> All data is encrypted both in transit and at rest</li>
                <li><strong>Secure servers:</strong> We use enterprise-grade security infrastructure</li>
                <li><strong>Access controls:</strong> Strict limits on who can access user data</li>
                <li><strong>Regular security audits:</strong> Ongoing assessments by cybersecurity professionals</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Operational Safeguards</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Staff training:</strong> All team members receive privacy and security training</li>
                <li><strong>Need-to-know basis:</strong> Access to user data is limited to essential functions</li>
                <li><strong>Open source transparency:</strong> Our security practices are visible in our public code</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Data Minimization</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>We collect only the information necessary to provide our services</li>
                <li>We delete data when it&apos;s no longer needed</li>
                <li>We provide tools for you to control and delete your own data</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention and Deletion</h2>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Conversation Data</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Active accounts:</strong> Conversation history is retained to provide continuity of support</li>
                <li><strong>Account deletion:</strong> All conversation data is permanently deleted within 30 days of account deletion</li>
                <li><strong>Inactive accounts:</strong> Data from inactive accounts is deleted after 2 years</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Crisis Intervention Records</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Safety-critical information:</strong> We may retain crisis intervention records longer for safety purposes</li>
                <li><strong>Professional referrals:</strong> Connection data with healthcare providers follows their retention policies</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Your Right to Delete</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>You can request deletion of your data at any time through the app or by contacting us</li>
                <li>We will confirm deletion within 30 days</li>
                <li>Some data may be retained if required by law or for safety reasons</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sharing Your Information</h2>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">We Do Not Sell Your Data</h3>
              <p className="text-gray-700">As a nonprofit organization, we never sell, rent, or trade your personal information.</p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Limited Sharing Situations</h3>

              <div className="mb-4">
                <h4 className="text-lg font-medium text-gray-900 mb-2">Crisis Intervention</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>We may share necessary information with crisis hotlines, emergency services, or healthcare providers if you are in immediate danger</li>
                  <li>This sharing is done only to protect your safety and wellbeing</li>
                </ul>
              </div>

              <div className="mb-4">
                <h4 className="text-lg font-medium text-gray-900 mb-2">Professional Referrals</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>When you choose to connect with licensed professionals, we share relevant information to facilitate your care</li>
                  <li>You control what information is shared in these situations</li>
                </ul>
              </div>

              <div className="mb-4">
                <h4 className="text-lg font-medium text-gray-900 mb-2">Service Providers</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>We work with trusted third-party services (like cloud hosting) that help us operate the app</li>
                  <li>These providers are bound by strict confidentiality agreements and cannot use your data for other purposes</li>
                </ul>
              </div>

              <div className="mb-4">
                <h4 className="text-lg font-medium text-gray-900 mb-2">Legal Requirements</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>We may disclose information if required by law, court order, or government regulation</li>
                  <li>We will notify you of such requests unless prohibited by law</li>
                </ul>
              </div>

              <div className="mb-4">
                <h4 className="text-lg font-medium text-gray-900 mb-2">Anonymized Research</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>We may share anonymized, aggregated data for research purposes to improve mental health support</li>
                  <li>This data cannot be traced back to any individual user</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights and Choices</h2>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Access and Control</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>View and download your conversation history</li>
                <li>Update your profile and preferences</li>
                <li>Control location sharing and other optional features</li>
                <li>Delete your account and all associated data</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Communication Preferences</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Choose how we communicate with you about app updates and features</li>
                <li>Opt out of non-essential communications at any time</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-gray-900 mb-3">Parental Rights (Users Under 18)</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Parents or guardians have the right to review their child&apos;s information</li>
                <li>Parents can request deletion of their child&apos;s account</li>
                <li>However, we may limit parental access to protect the child&apos;s privacy and safety in sensitive situations</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children&apos;s Privacy (COPPA Compliance)</h2>
            <p className="text-gray-700 mb-4">We take special care with users under 13:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>We collect minimal information from users under 13</li>
              <li>We obtain verifiable parental consent before collecting information from children under 13</li>
              <li>Parents can review, delete, or refuse further collection of their child&apos;s information</li>
              <li>We do not require children to provide more information than necessary to use the app</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Open Source Transparency</h2>
            <p className="text-gray-700 mb-4">As an open source project, our code is publicly available on GitHub. This means:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>You can examine exactly how we handle your data</li>
              <li>Security experts can review our privacy implementations</li>
              <li>Our data practices are transparent and verifiable</li>
              <li>Community contributions help improve our privacy protections</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">International Users</h2>
            <p className="text-gray-700 mb-4">If you&apos;re using RiseTwice outside the United States:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Your information may be transferred to and processed in the United States</li>
              <li>We comply with applicable international privacy laws</li>
              <li>We provide the same privacy protections regardless of your location</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
            <p className="text-gray-700 mb-4">We may update this Privacy Policy occasionally. When we do:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>We&apos;ll notify you through the app and via email (if you&apos;ve provided one)</li>
              <li>The updated policy will include the new effective date</li>
              <li>Significant changes will be highlighted and may require your consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700 mb-4">If you have questions, concerns, or requests regarding your privacy:</p>
            <div className="text-gray-700 space-y-2">
              <p><strong>Email:</strong> privacy@risetwice.com</p>
              <p><strong>Mail:</strong> RiseTwice Privacy Officer, [Address]</p>
              <p><strong>In-App:</strong> Use the &quot;Privacy & Support&quot; section in the app settings</p>
              <p><strong>Response Time:</strong> We will respond to privacy requests within 30 days.</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Crisis Resources</h2>
            <p className="text-gray-700 mb-4">If you&apos;re in immediate danger or having thoughts of suicide:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Call 911</strong> (US Emergency Services)</li>
              <li><strong>Call 988</strong> (Suicide & Crisis Lifeline)</li>
              <li><strong>Text HOME to 741741</strong> (Crisis Text Line)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Trust Matters</h2>
            <p className="text-gray-700">
              We understand that trusting an app with your mental health concerns is a big decision. We&apos;re committed to earning and maintaining that trust through transparency, security, and putting your wellbeing first. Our nonprofit mission means we&apos;re accountable to you and the community we serve, not to shareholders or profit motives.
            </p>
          </section>

          <hr className="border-gray-300 my-8" />

          <div className="text-sm text-gray-600 italic">
            <p>This Privacy Policy is part of our Terms of Service and governs your use of RiseTwice. By using our app, you agree to the collection and use of information as described in this policy.</p>
          </div>
        </div>
      </div>
    </div>
  );
}