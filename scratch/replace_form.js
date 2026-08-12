const fs = require('fs');

const path = 'Tenant-v2/src/components/TeamsWorkspace.tsx';
let content = fs.readFileSync(path, 'utf8');

const startStr = '/* GUIDED MULTI-SECTION ROSTER PROFILE FORM */';
const startIndex = content.indexOf(startStr);

if (startIndex === -1) {
  console.log('Start index not found');
  process.exit(1);
}

// Find the end of the form. The form ends with </form> then some divs then )}
const formEndIndex = content.indexOf('</form>', startIndex);
if (formEndIndex === -1) {
  console.log('Form end index not found');
  process.exit(1);
}

// The exact structure after </form> is:
//             </form>
//
//           </div>
//
//         </div>
//       )}
const endStr = ')}';
const endIndex = content.indexOf(endStr, formEndIndex);

if (endIndex === -1) {
  console.log('End index not found');
  process.exit(1);
}

const replacement = `/* GUIDED MULTI-SECTION ROSTER PROFILE FORM */
        <EmployeeProfileEditor
          initialData={formData}
          isRtl={isRtl}
          formMode={formMode}
          onSave={handleSaveMember}
          onCancel={() => setActiveView('list')}
          initialStaffAppPermissions={staffAppPermissions}
        />
      )}`;

content = content.slice(0, startIndex) + replacement + content.slice(endIndex + endStr.length);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully replaced form with EmployeeProfileEditor');
