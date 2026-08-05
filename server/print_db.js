const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/models');

async function run() {
    try {
        const appointment = await db.Appointment.findOne({
            order: [['createdAt', 'DESC']],
            raw: true
        });

        if (!appointment) {
            console.log("No appointments found in database.");
            return;
        }

        console.log("=== APPOINTMENT ===");
        console.log(`Appointment.id: ${appointment.id}`);
        console.log(`Appointment.price: ${appointment.price}`);
        console.log(`Appointment.taxAmount: ${appointment.taxAmount}`);
        console.log(`Appointment.totalPaid: ${appointment.totalPaid}`);
        console.log(`Appointment.remainderAmount: ${appointment.remainderAmount}`);
        console.log(`Appointment.depositAmount: ${appointment.depositAmount}`);
        console.log(`Appointment.platformFee: ${appointment.platformFee}`);
        console.log(`Appointment.rawPrice: ${appointment.rawPrice}`);
        console.log(`Appointment.totalAmount: ${appointment.totalAmount !== undefined ? appointment.totalAmount : 'undefined'}`);

        if (appointment.bookingSessionId) {
            const session = await db.BookingSession.findOne({
                where: { id: appointment.bookingSessionId },
                raw: true
            });
            console.log("\n=== BOOKING SESSION ===");
            console.log(`BookingSession.totalAmount: ${session ? session.totalAmount : 'Not found'}`);
            
            // Check for Invoice using bookingSessionId
            try {
                const invoice = await db.CustomerInvoice.findOne({
                    where: { bookingSessionId: appointment.bookingSessionId },
                    raw: true
                });
                console.log("\n=== INVOICE ===");
                if (invoice) {
                    console.log(`Invoice.subtotal: ${invoice.subtotal}`);
                    console.log(`Invoice.vatAmount: ${invoice.vatAmount}`);
                    console.log(`Invoice.totalAmount: ${invoice.totalAmount}`);
                } else {
                    console.log("No invoice found.");
                }
            } catch (e) {
                console.log("\n=== INVOICE ===");
                console.log("Invoice check failed or table not found.");
            }
        }
        
    } catch (e) {
        console.error("Error fetching record:", e);
    } finally {
        process.exit();
    }
}

run();
