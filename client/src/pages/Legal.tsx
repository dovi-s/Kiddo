import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Eye, AlertTriangle, ArrowRight } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";

type Tab = "terms" | "privacy" | "disclosures";

export default function Legal() {
  const [activeTab, setActiveTab] = useState<Tab>("terms");

  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "terms", label: "Terms of Service", icon: FileText },
    { id: "privacy", label: "Privacy Policy", icon: Eye },
    { id: "disclosures", label: "Disclosures", icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground" data-testid="text-legal-heading">
            Legal
          </h1>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-tab-${tab.id}`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-card rounded-2xl shadow-premium-sm p-8 md:p-12"
        >
          {activeTab === "terms" && (
            <div className="prose prose-sm max-w-none" data-testid="content-terms">
              <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Terms of Service</h2>
              <p className="text-sm text-muted-foreground mb-4">Last updated: February 2026</p>

              <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                <div>
                  <h3 className="font-medium text-foreground mb-2">1. What Kora Is</h3>
                  <p>Kora is a technology platform that makes it easy to give stock investments as gifts. We are not a broker-dealer, investment adviser, or bank. Brokerage services are provided by our clearing partners, who are registered with FINRA and members of SIPC.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">2. Account Eligibility</h3>
                  <p>You must be at least 18 years old and a U.S. resident to create a Kora account. Custodial (UTMA) accounts can be opened for minors by a parent or legal guardian. Gift-givers do not need an account to send gifts.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">3. How Gifts Work</h3>
                  <p>When someone sends a gift through Kora, the payment is processed via Stripe. Once the payment clears (typically 1 to 2 business days), the funds are directed to the recipient's investment account. Depending on the fund's settings, the money may be automatically invested or held as cash until the account owner decides.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">4. Fees</h3>
                  <p>Kora charges a platform fee of 1.5% on each gift (minimum $1, maximum $10). Payment processing fees also apply: card, Apple Pay, and Google Pay are approximately 2.9% + $0.30 per transaction; bank transfers (ACH) are 0.8%, capped at $5. Family Plan ($149/year) and Event Pass ($99 one-time) members have the platform fee waived up to specified limits. All fees are disclosed to the giver before payment.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">5. Investment Risk</h3>
                  <p>All investments involve risk, including the possible loss of principal. Past performance does not guarantee future results. The value of your investments may go up or down. Kora does not provide investment advice. You are responsible for your own investment decisions.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">6. UTMA Accounts</h3>
                  <p>Custodial (UTMA) accounts are managed by the custodian (parent or guardian) for the benefit of the minor. Assets in a UTMA account are irrevocable gifts to the minor and transfer to their control when they reach the age of majority in their state (typically 18 or 21). The custodian may sell investments and withdraw funds at any time, provided the funds are used for the child's benefit, as required by UTMA law. For adult (personal taxable) accounts, the account owner has full control to sell investments and withdraw at any time.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">7. Account Closure</h3>
                  <p>You may close your account at any time. Outstanding investments will need to be sold or transferred before account closure. Standard ACATS transfer to another brokerage is supported.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">8. Changes to Terms</h3>
                  <p>We may update these terms from time to time. We will notify you of material changes via email or in-app notification. Continued use of Kora after changes constitutes acceptance of the updated terms.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="prose prose-sm max-w-none" data-testid="content-privacy">
              <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Privacy Policy</h2>
              <p className="text-sm text-muted-foreground mb-4">Last updated: February 2026</p>

              <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                <div>
                  <h3 className="font-medium text-foreground mb-2">What We Collect</h3>
                  <p>We collect information you provide when creating an account (name, email, password), activating investing (legal name, date of birth, address, last 4 of SSN), and sending gifts (name, email, message). We also collect usage data to improve the platform.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">How We Use Your Information</h3>
                  <p>We use your information to provide our services, process transactions, verify your identity for regulatory compliance, communicate with you about your account, and improve our platform. We never sell your personal information.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Who We Share With</h3>
                  <p>We share information with our clearing partners (to open and manage investment accounts), payment processors (to process transactions), and as required by law. We do not sell or rent your personal information to third parties for marketing purposes.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Children's Privacy</h3>
                  <p>We take children's privacy seriously. Minors' accounts are non-discoverable by default and accessible only via direct link. Public-facing pages for minors display only the child's first name. We comply with COPPA and do not knowingly collect personal information from children under 13 without parental consent.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Data Security</h3>
                  <p>We use 256-bit SSL encryption, secure data storage, and follow industry best practices for data protection. Your identity verification data (like SSN) is encrypted and transmitted directly to our clearing partners.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Your Rights</h3>
                  <p>You can request access to, correction of, or deletion of your personal information at any time by contacting us. California residents have additional rights under the CCPA.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Cookies</h3>
                  <p>We use essential cookies for authentication and session management. We use analytics cookies to understand how people use Kora so we can make it better. You can disable non-essential cookies in your browser settings.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "disclosures" && (
            <div className="prose prose-sm max-w-none" data-testid="content-disclosures">
              <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Disclosures</h2>
              <p className="text-sm text-muted-foreground mb-4">Last updated: February 2026</p>

              <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                <div className="bg-primary/5 rounded-xl p-5 border border-primary/10">
                  <p className="font-medium text-foreground mb-2">Important Notice</p>
                  <p>Kora Inc. is a technology company, not a broker-dealer, investment adviser, or bank. Kora does not provide investment advice or recommendations.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Brokerage Services</h3>
                  <p>Securities are offered through our clearing partners, which are FINRA-registered broker-dealers and SIPC members. Clearing and custody services are provided by the clearing firm. Kora facilitates the user experience but does not execute trades or hold customer assets.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">SIPC Coverage</h3>
                  <p>Accounts are protected by SIPC up to $500,000 (including $250,000 for cash claims). SIPC protects against the loss of securities and cash in the event of a broker-dealer failure. SIPC does not protect against market losses.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Investment Risks</h3>
                  <p>Investing in securities involves risk. The value of your investments may fluctuate, and you may receive back less than you originally invested. Past performance is not indicative of future results. Historical averages (such as 10% annual returns) are not guaranteed.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Not FDIC Insured</h3>
                  <p>Investment accounts are not bank deposits and are not insured by the FDIC or any government agency. They are not guaranteed by any bank and may lose value.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Tax Information</h3>
                  <p>Gifts of securities may have tax implications. The annual gift tax exclusion is $19,000 per recipient (2025). Gifts over this amount may require filing a gift tax return. Investment gains in UTMA accounts may be subject to the kiddie tax if unearned income exceeds $2,700. Consult a tax professional for advice specific to your situation.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Regulatory Information</h3>
                  <p>Check the background of our clearing partners on <a href="https://brokercheck.finra.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">FINRA's BrokerCheck</a>.</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-6">Have questions about any of this?</p>
          <Link href="/faq">
            <Button variant="outline" data-testid="button-legal-faq">
              Visit our FAQ
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
