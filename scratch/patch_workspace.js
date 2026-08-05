const fs = require('fs');
const path = require('path');

const targetPath = path.join('.', 'Tenant-v2', 'src', 'components', 'AppointmentWorkspace.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const anchorStart = `{/* SPLIT PAYMENTS COMPONENT CONTAINER */}`;
const splitTarget1 = `                    <div className="pt-3 border-t border-slate-100 space-y-3">`;

const replacement1 = `                    {(() => {
                      const isAlreadyFullyPaid = 
                        activeAppointment.paymentStatus === 'paid' || 
                        activeAppointment.paymentStatus === 'fully_paid' || 
                        (activeInvoiceTotal > 0 && Math.max(0, activeInvoiceTotal - Number(activeAppointment.totalPaid ?? 0)) <= 0);

                      if (isAlreadyFullyPaid) {
                        return (
                          <div className="pt-3 border-t border-slate-100 mt-2">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-emerald-800 text-center shadow-sm">
                              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-1">
                                <CheckCircle2 size={26} className="text-emerald-600" />
                              </div>
                              <h4 className="font-black text-sm">{isRtl ? 'تم السداد بالكامل' : 'Payment Completed'}</h4>
                              <p className="text-xs font-bold opacity-90">
                                {isRtl ? 'المبلغ المسدد:' : 'Amount Paid:'} <span className="font-mono">{Number(activeAppointment.totalPaid ?? 0).toFixed(2)} {t.riyal}</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <>
                          <div className="pt-3 border-t border-slate-100 space-y-3">`;

const anchorEnd = `                          <CheckCircle2 size={15} className="text-amber-400" />
                          <span>{t.checkout}</span>
                        </button>
                      )}
                    </div>`;

const replacement2 = `                          <CheckCircle2 size={15} className="text-amber-400" />
                          <span>{t.checkout}</span>
                        </button>
                      )}
                    </div>
                        </>
                      );
                    })()}`;

if (content.includes(anchorStart) && content.includes(anchorEnd)) {
  // Replace the first div after the comment
  const idx1 = content.indexOf(anchorStart) + anchorStart.length;
  const startPart = content.substring(0, idx1);
  const restPart = content.substring(idx1);
  const newRestPart = restPart.replace(splitTarget1.trim(), replacement1.trim());
  content = startPart + "\\n" + newRestPart;

  content = content.replace(anchorEnd, replacement2);
  
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log("Successfully patched AppointmentWorkspace.tsx");
} else {
  console.log("Error: Could not find anchors in the file");
}
