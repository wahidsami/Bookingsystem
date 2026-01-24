"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

function BookingTest() {
    const searchParams = useSearchParams();
    const tenantId = searchParams.get("tenantId");
    const [step, setStep] = useState(1);

    const handleClick = () => {
        setStep(2);
    };

    if (!tenantId) {
        return <div>No tenant</div>;
    }

    return (
        <div className="min-h-screen bg-white">
            <div className="p-4">
                <h1>Booking Test - Step {step}</h1>
                <button onClick={handleClick} className="px-4 py-2 bg-blue-500 text-white">
                    Next Step
                </button>
            </div>
        </div>
    );
}

export default function BookingTestPage() {
    return <BookingTest />;
}
