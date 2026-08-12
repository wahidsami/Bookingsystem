const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../Tenant-v2/src/components/TeamsWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove states
content = content.replace(/^[ \t]*\/\/ Guided form editor active section[\s\S]*?useState<'basic' \| 'bio' \| 'finance' \| 'schedule' \| 'access'>\('basic'\);\n/gm, '');
content = content.replace(/^[ \t]*const \[employeePhotoFile, setEmployeePhotoFile\].*\n/gm, '');
content = content.replace(/^[ \t]*const employeePhotoInputRef = useRef<HTMLInputElement \| null>\(null\);\n/gm, '');

// Remove specialty adders
const specialtyStart = content.indexOf('// Specialty Helper Adders');
if (specialtyStart > 0) {
  const langEndSearch = content.indexOf('const handleRemoveLanguage', specialtyStart);
  if (langEndSearch > 0) {
    const endSpecialtyBlock = content.indexOf('  };\n', langEndSearch) + 5;
    content = content.substring(0, specialtyStart) + content.substring(endSpecialtyBlock);
  }
}

// 2. Remove state mutations in setFormMode('add') / 'edit'
content = content.replace(/setActiveFormSection\('basic'\);\n/g, '');
content = content.replace(/setEmployeePhotoFile\(null\);\n/g, '');

content = content.replace(
  /onClick=\{\(\) => \{\n\s*setFormData\(member\);\n\s*setFormMode\('edit'\);\n\s*setActiveView\('form'\);\n\s*fetchStaffAppPermissions\(member\.id\);\n\s*\}\}/g,
  `onClick={async () => {
                              setFormData(member);
                              setFormMode('edit');
                              await fetchStaffAppPermissions(member.id);
                              setActiveView('form');
                            }}`
);

// 3. Update handleSaveMember
const handleSaveMemberStart = content.indexOf('const handleSaveMember = async (e: React.FormEvent) => {');
const handleSaveMemberEnd = content.indexOf('const handleDeleteMember = async', handleSaveMemberStart);
if (handleSaveMemberStart > 0 && handleSaveMemberEnd > 0) {
  let saveMemberBody = content.substring(handleSaveMemberStart, handleSaveMemberEnd);
  saveMemberBody = saveMemberBody.replace(
    /const handleSaveMember = async \(e: React\.FormEvent\) => \{\n\s*e\.preventDefault\(\);\n/g,
    `const handleSaveMember = async (\n    submittedData: TeamMemberData,\n    photo: File | null,\n    submittedPermissions: Record<StaffAppPermissionKey, boolean>\n  ) => {\n`
  );
  saveMemberBody = saveMemberBody.replace(/\bformData\b/g, 'submittedData');
  saveMemberBody = saveMemberBody.replace(/\bemployeePhotoFile\b/g, 'photo');
  saveMemberBody = saveMemberBody.replace(/\bstaffAppPermissions\b/g, 'submittedPermissions');
  content = content.substring(0, handleSaveMemberStart) + saveMemberBody + content.substring(handleSaveMemberEnd);
}

// 4. Replace form body
const formStartString = '/* GUIDED MULTI-SECTION ROSTER PROFILE FORM */';
const formStartIndex = content.indexOf(formStartString);
if (formStartIndex > 0) {
  const activeViewEndMatch = content.indexOf('</div>\n\n        </div>\n      )}\n\n    </div>\n  );\n}');
  if (activeViewEndMatch > 0) {
    const replacement = `/* GUIDED MULTI-SECTION ROSTER PROFILE FORM */
          <EmployeeProfileEditor
            initialData={formData}
            isRtl={isRtl}
            formMode={formMode}
            onSave={handleSaveMember}
            onCancel={() => setActiveView('list')}
            initialStaffAppPermissions={staffAppPermissions}
            onAIAssist={generateAIContext}
          />\n`;
    content = content.substring(0, formStartIndex) + replacement + content.substring(activeViewEndMatch);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script executed');
