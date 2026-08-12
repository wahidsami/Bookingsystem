const fs = require('fs');
const path = 'Tenant-v2/src/components/AppointmentWorkspace.tsx';

let content = fs.readFileSync(path, 'utf8');

const anchor1 = `                    {/* SPLIT PAYMENTS COMPONENT CONTAINER */}
                    {(() => {
                      const isAlreadyFullyPaid = 
                        activeAppointment.paymentStatus === 'paid' || 
                        activeAppointment.paymentStatus === 'fully_paid' || 
                        (activeInvoiceTotal > 0 && Math.max(0, activeInvoiceTotal - Number(activeAppointment.totalPaid ?? 0)) <= 0);

                      if (isAlreadyFullyPaid) {`;

const newAnchor1 = `                    {/* SPLIT PAYMENTS COMPONENT CONTAINER */}
                    {(() => {
                      const totalDue = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0));
                      const splitSum = (splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0);
                      const remaining = Math.max(0, totalDue - splitSum);
                      const isSplitValid = totalDue > 0 && Math.abs(splitSum - totalDue) < 0.01;
                      const isSplitComplete = totalDue > 0 && remaining === 0 && isSplitValid;
                      const hasOverpayment = splitSum > totalDue + 0.01;
                      
                      const isAlreadyFullyPaid = 
                        activeAppointment.paymentStatus === 'paid' || 
                        activeAppointment.paymentStatus === 'fully_paid' || 
                        (activeInvoiceTotal > 0 && Math.max(0, activeInvoiceTotal - Number(activeAppointment.totalPaid ?? 0)) <= 0);

                      if (isAlreadyFullyPaid) {`;

const anchor2 = `                          {(() => {
                            const totalDue = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0));
                            const splitSum = (splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0);
                            const remaining = Math.max(0, totalDue - splitSum);
                            const isSplitValid = totalDue > 0 && Math.abs(splitSum - totalDue) < 0.01;
                            const isSplitComplete = totalDue > 0 && remaining === 0 && isSplitValid;
                            const hasOverpayment = splitSum > totalDue + 0.01;

                            return (
                              <>`;

const newAnchor2 = `                          {(() => {
                            return (
                              <>`;

const anchor3 = `                    {/* Checkout and Complete operation */}
                    <div className="pt-3">
                        <button
                          disabled={!selectedPaymentMethod.trim()}
                          onClick={() => {
                            if (!selectedPaymentMethod.trim()) {
                              addLocalToast(
                                'الرجاء اختيار طريقة الدفع أولاً.',
                                'Please choose a payment method first.',
                                'warning'
                              );
                              return;
                            }
                            setShowPaymentConfirmModal(true);
                          }}
                          className={\`w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold tracking-wider transition-all shadow-md flex items-center justify-center gap-2 \${
                            selectedPaymentMethod.trim() ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                          }\`}
                        >`;

const newAnchor3 = `                    {/* Checkout and Complete operation */}
                    <div className="pt-3">
                        <button
                          disabled={isSplitActive ? !isSplitComplete : !selectedPaymentMethod.trim()}
                          onClick={() => {
                            if (isSplitActive) {
                                if (!isSplitComplete) {
                                    addLocalToast(
                                      'الرجاء إكمال تخصيص تقسيم المدفوعات.',
                                      'Please complete the split payment allocation.',
                                      'warning'
                                    );
                                    return;
                                }
                            } else if (!selectedPaymentMethod.trim()) {
                              addLocalToast(
                                'الرجاء اختيار طريقة الدفع أولاً.',
                                'Please choose a payment method first.',
                                'warning'
                              );
                              return;
                            }
                            setShowPaymentConfirmModal(true);
                          }}
                          className={\`w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold tracking-wider transition-all shadow-md flex items-center justify-center gap-2 \${
                            (isSplitActive ? isSplitComplete : selectedPaymentMethod.trim()) ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                          }\`}
                        >`;

content = content.replace(anchor1, newAnchor1);
content = content.replace(anchor2, newAnchor2);
content = content.replace(anchor3, newAnchor3);

fs.writeFileSync(path, content, 'utf8');
console.log("Button patched.");
