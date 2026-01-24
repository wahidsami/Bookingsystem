import Link from "next/link";

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            {/* Header */}
            <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                            <span className="text-white font-bold text-xl">R</span>
                        </div>
                        <span className="text-2xl font-bold text-gradient">Rifah</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6">
                        <Link href="#features" className="text-sm font-medium hover:opacity-70 transition-opacity">
                            Features
                        </Link>
                        <Link href="/booking" className="px-4 py-2 rounded-lg gradient-primary text-white font-medium hover:shadow-lg transition-all">
                            Book Now
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="container mx-auto px-4 py-20 text-center animate-fade-in">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                        <span className="text-gradient">Transform</span> Your Salon
                        <br />
                        Experience
                    </h1>
                    <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                        AI-powered booking platform designed for modern salons and spas.
                        Streamline operations, delight customers, and grow your business.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/booking"
                            className="px-8 py-4 rounded-lg gradient-primary text-white font-semibold text-lg hover:shadow-2xl transition-all transform hover:scale-105"
                        >
                            Start Booking
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto">
                    {[
                        { value: "2.5%", label: "Platform Fee" },
                        { value: "24/7", label: "WhatsApp Bot" },
                        { value: "AI", label: "Smart Recommendations" },
                        { value: "99.9%", label: "Uptime" },
                    ].map((stat, i) => (
                        <div key={i} className="animate-slide-up">
                            <div className="text-4xl font-bold text-gradient mb-2">{stat.value}</div>
                            <div className="text-sm text-gray-600">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="container mx-auto px-4 py-20">
                <h2 className="text-4xl font-bold text-center mb-4">
                    Everything You Need to <span className="text-gradient">Succeed</span>
                </h2>
                <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
                    Built for the Saudi Arabian market with compliance, localization, and premium features.
                </p>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        {
                            icon: "🤖",
                            title: "AI-Powered Booking",
                            description: "Smart recommendations for staff, time slots, and services based on customer preferences."
                        },
                        {
                            icon: "💬",
                            title: "WhatsApp Integration",
                            description: "Full-featured bot for bookings, cancellations, and reminders via WhatsApp."
                        },
                        {
                            icon: "💰",
                            title: "Dynamic Pricing",
                            description: "Automated pricing based on demand, time, and occupancy with real-time analytics."
                        },
                        {
                            icon: "👥",
                            title: "Staff Management",
                            description: "Performance tracking, automated payroll, and skill-based service assignments."
                        },
                        {
                            icon: "📊",
                            title: "Analytics Dashboard",
                            description: "Real-time insights on revenue, capacity, customer trends, and staff performance."
                        },
                        {
                            icon: "🔒",
                            title: "Secure & Compliant",
                            description: "SAMA, SDPL, and GDPR compliant with encrypted data and audit logs."
                        },
                    ].map((feature, i) => (
                        <div
                            key={i}
                            className="card-premium p-6 hover:scale-105 transition-transform animate-slide-up"
                        >
                            <div className="text-4xl mb-4">{feature.icon}</div>
                            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                            <p className="text-gray-600 text-sm">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="container mx-auto px-4 py-20">
                <div className="gradient-primary rounded-2xl p-12 text-center text-white">
                    <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
                    <p className="text-xl mb-8 opacity-90">
                        Join hundreds of salons already using Rifah
                    </p>
                    <Link
                        href="/booking"
                        className="inline-block px-8 py-4 rounded-lg bg-white text-purple-600 font-semibold text-lg hover:shadow-2xl transition-all transform hover:scale-105"
                    >
                        Book Your First Appointment
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t bg-white/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                                <span className="text-white font-bold">R</span>
                            </div>
                            <span className="font-bold">Rifah</span>
                        </div>
                        <div className="text-sm text-gray-600">
                            © 2024 Rifah. All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
