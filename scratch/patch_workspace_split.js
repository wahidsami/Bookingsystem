const fs = require('fs');
const path = 'Tenant-v2/src/components/AppointmentWorkspace.tsx';

let content = fs.readFileSync(path, 'utf8');

const targetStr = `{isSplitActive ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 w-16">{isRtl ? 'بطاقة عند المركز' : 'Card POS'}</span>
                            <input 
                              type="number" 
                              value={splitAmounts.card}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const totalDue = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0));
                                setSplitAmounts(prev => {
                                  const next = { ...prev, card: val };
                                  next.cash = Math.max(0, totalDue - next.card - next.wallet);
                                  return next;
                                });
                              }}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded p-1 text-right font-mono text-xs font-bold"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 w-16">{isRtl ? 'نقد كاش' : 'Cash'}</span>
                            <input 
                              type="number" 
                              value={splitAmounts.cash}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const totalDue = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0));
                                setSplitAmounts(prev => {
                                  const next = { ...prev, cash: val };
                                  next.card = Math.max(0, totalDue - next.cash - next.wallet);
                                  return next;
                                });
                              }}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded p-1 text-right font-mono text-xs font-bold"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 w-16">{isRtl ? 'المحفظة' : 'Wallet'}</span>
                            <input 
                              type="number" 
                              value={splitAmounts.wallet}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const totalDue = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0));
                                setSplitAmounts(prev => {
                                  const next = { ...prev, wallet: val };
                                  next.cash = Math.max(0, totalDue - next.card - next.wallet);
                                  return next;
                                });
                              }}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded p-1 text-right font-mono text-xs font-bold"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          {isRtl ? 'تسمح هذه الأداة بتقسيم الفاتورة الكلية على أكثر من طريقة دفع (مثل البطاقة + كاش).' : 'Allows split distribution among multiple payment methods (Card, Cash, Wallet, Bank transfer).'}
                        </p>
                      )}`;

const replacementStr = `{isSplitActive ? (
                        <div className="space-y-3 animate-fadeIn mt-2">
                          {(() => {
                            const totalDue = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0));
                            const splitSum = (splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0);
                            const remaining = Math.max(0, totalDue - splitSum);
                            const isSplitValid = totalDue > 0 && Math.abs(splitSum - totalDue) < 0.01;
                            const isSplitComplete = totalDue > 0 && remaining === 0 && isSplitValid;
                            const hasOverpayment = splitSum > totalDue + 0.01;

                            return (
                              <>
                                <div className={\`p-2 rounded-lg border \${isSplitComplete ? 'bg-emerald-50 border-emerald-200' : (hasOverpayment ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200')}\`}>
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-slate-500">{isRtl ? 'المطلوب:' : 'Invoice Total:'}</span>
                                    <span className="font-bold font-mono">{totalDue.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-slate-500">{isRtl ? 'المدفوع:' : 'Allocated Amount:'}</span>
                                    <span className={\`font-bold font-mono \${hasOverpayment ? 'text-rose-600' : 'text-emerald-600'}\`}>{splitSum.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] font-black pt-1 border-t border-slate-200 border-dashed">
                                    <span className={hasOverpayment ? 'text-rose-600' : 'text-slate-700'}>{isRtl ? 'المتبقي:' : 'Remaining Balance:'}</span>
                                    <span className={\`font-mono \${isSplitComplete ? 'text-emerald-600' : (hasOverpayment ? 'text-rose-600' : 'text-amber-600')}\`}>
                                      {isSplitComplete ? (isRtl ? 'اكتمل التخصيص' : 'Allocation Complete') : \`\${remaining.toFixed(2)}\`}
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Mada</label>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        if (!splitAmounts.card && remaining > 0) {
                                          setSplitAmounts(prev => ({ ...prev, card: parseFloat((remaining + (prev.card || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-amber-100 text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={splitAmounts.card || ''} onChange={(e) => setSplitAmounts(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Cash</label>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        if (!splitAmounts.cash && remaining > 0) {
                                          setSplitAmounts(prev => ({ ...prev, cash: parseFloat((remaining + (prev.cash || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-amber-100 text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={splitAmounts.cash || ''} onChange={(e) => setSplitAmounts(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Wallet</label>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        if (!splitAmounts.wallet && remaining > 0) {
                                          setSplitAmounts(prev => ({ ...prev, wallet: parseFloat((remaining + (prev.wallet || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-amber-100 text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={splitAmounts.wallet || ''} onChange={(e) => setSplitAmounts(prev => ({ ...prev, wallet: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 leading-relaxed mt-2">
                          {isRtl ? 'تسمح هذه الأداة بتقسيم الفاتورة الكلية على أكثر من طريقة دفع (مثل البطاقة + كاش).' : 'Allows split distribution among multiple payment methods (Card, Cash, Wallet, Bank transfer).'}
                        </p>
                      )}`;

if (content.indexOf(targetStr) === -1) {
  console.log("Error: Target string not found.");
  // Fallback to substring matching
  const idxStart = content.indexOf('{isSplitActive ? (');
  if (idxStart !== -1) {
    const idxEnd = content.indexOf('</p>', idxStart) + 4;
    const endStr = '                      )}';
    const trueEnd = content.indexOf(endStr, idxEnd) + endStr.length;
    if (trueEnd !== -1) {
      console.log("Applying fallback replacement via substring indices...");
      content = content.substring(0, idxStart) + replacementStr + content.substring(trueEnd);
      fs.writeFileSync(path, content, 'utf8');
      console.log("Success.");
      process.exit(0);
    }
  }
} else {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Success.");
}
