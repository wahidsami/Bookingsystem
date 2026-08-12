const fs = require('fs');

const path = 'Tenant-v2/src/components/AppointmentWorkspace.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Import
const importStr = "import TeamMemberProfileDrawer from './employee-profile/TeamMemberProfileDrawer';";
if (!content.includes(importStr)) {
  const importAnchor = "import InteractiveDrawers from './InteractiveDrawers';";
  content = content.replace(importAnchor, importAnchor + '\n' + importStr);
}

// 2. Replace Drawer Block
const startStr = '{/* 9. VIEW TEAM MEMBER DRAWER */}';
const startIndex = content.indexOf(startStr);
if (startIndex === -1) {
  console.log('Start index not found');
  process.exit(1);
}

const endStr = '      {/* End of render */}'; // Wait, let me just find the end of the AnimatePresence block.
const endOfBlockStr = '          </>\n        )}\n      </AnimatePresence>';
let endIndex = content.indexOf(endOfBlockStr, startIndex);
if (endIndex === -1) {
    const fallbackEnd = '      </AnimatePresence>';
    endIndex = content.indexOf(fallbackEnd, startIndex) + fallbackEnd.length;
} else {
    endIndex += endOfBlockStr.length;
}

if (endIndex === -1 || endIndex < startIndex) {
  console.log('End index not found or invalid');
  process.exit(1);
}

const replacement = `{/* 9. VIEW TEAM MEMBER DRAWER */}
      <AnimatePresence>
        {viewTeamMemberStaffId && (
          <TeamMemberProfileDrawer
            staffId={viewTeamMemberStaffId}
            onClose={() => setViewTeamMemberStaffId(null)}
            isRtl={isRtl}
            onRefreshBoard={() => {
                // To force a refresh, we could trigger a re-fetch of master data.
                // In AppointmentWorkspace, there isn't a direct exported fetch function,
                // but the drawer update is complete.
            }}
          />
        )}
      </AnimatePresence>`;

content = content.slice(0, startIndex) + replacement + content.slice(endIndex);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully replaced drawer');
