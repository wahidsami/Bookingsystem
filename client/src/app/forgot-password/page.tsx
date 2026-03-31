"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BRANDING } from "@/config/branding";

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 relative">
            <div className="absolute top-4 end-4">
                <LanguageSwitcher variant="toggle" />
            </div>

            <div className="w-full max-w-xl">
                <div className="bg-white/85 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
                    <div className="flex justify-center mb-6">
                        <img src="/rifah-logo.svg" alt="Rifah Logo" className="h-16 w-auto" />
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-primary mb-3">Reset Password</h1>
                        <p className="text-gray-600">
                            Password reset is not enabled in this testing stage yet.
                        </p>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-6">
                        <p className="text-amber-900 font-semibold mb-2">Current testing flow</p>
                        <p className="text-sm text-amber-800 leading-6">
                            For now, please contact the platform team to reset your password, or go back and sign in with your existing test account.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <Link
                            href="/login"
                            className="block w-full text-center bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                        >
                            Back To Login
                        </Link>
                        <Link
                            href="/register"
                            className="block w-full text-center border border-primary text-primary py-3 rounded-lg font-semibold hover:bg-primary/5 transition-colors"
                        >
                            Create New Account
                        </Link>
                    </div>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        {BRANDING.name}
                    </div>
                </div>
            </div>
        </div>
    );
}
