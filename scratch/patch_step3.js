const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'Tenant-v2', 'src', 'components', 'InteractiveDrawers.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import ExpandableServiceRow from './ExpandableServiceRow';", "import AppointmentServicesStep from './appointment/AppointmentServicesStep';");

const startIndex = content.indexOf('                    {createStep === 3 && (');
const endIndex = content.indexOf('                    {createStep === 4 && (');

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.slice(0, startIndex);
  const after = content.slice(endIndex);
  
  const replacement = `                    {createStep === 3 && (
                      <AppointmentServicesStep
                        isRtl={isRtl}
                        canonicalServices={canonicalServices}
                        stagedServices={stagedServices as any[]}
                        availableStylists={availableStylists}
                        serviceCategoryTabs={serviceCategoryTabs}
                        currentServiceCategory={currentServiceCategory}
                        setCurrentServiceCategory={setCurrentServiceCategory}
                        serviceSearch={serviceSearch}
                        setServiceSearch={setServiceSearch}
                        onAddService={handleToggleServiceSelection}
                        onUpdateService={handleUpdateStagedService}
                        onRemoveService={(index) => setStagedServices(prev => prev.filter((_, i) => i !== index))}
                        formatMinutesToTime={formatMinutesToTime}
                        onPrevious={() => setCreateStep(2)}
                        onNext={() => {
                          if (stagedServices.length === 0) {
                            addLocalToast(
                              isRtl ? 'يرجى إدراج خدمة واحدة على الأقل للمتابعة إلى الفاتورة' : 'Please add at least one service before opening the invoice step',
                              isRtl ? 'Please add at least one service before opening the invoice step' : 'يرجى إدراج خدمة واحدة على الأقل للمتابعة إلى الفاتورة',
                              'warning'
                            );
                            return;
                          }
                          setCreateStep(4);
                        }}
                      />
                    )}

`;

  fs.writeFileSync(file, before + replacement + after, 'utf8');
  console.log("Successfully replaced Step 3");
} else {
  console.log("Could not find start or end index");
  console.log("startIndex:", startIndex);
  console.log("endIndex:", endIndex);
}
