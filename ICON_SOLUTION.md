# Icon Solution for About Us Section

## Problem
Users need to add icons for missions, visions, and values. We need a way to suggest appropriate icons based on the content.

## Solution: Heroicons + Optional Gemini AI Integration

### Primary Solution: Heroicons Icon Picker
- **Heroicons** is already integrated in the project (`@heroicons/react`)
- Users can manually select icons from a searchable icon picker
- Icons are stored as icon names (e.g., "HeartIcon", "StarIcon")
- Frontend dynamically imports and displays the icon

### Optional Enhancement: Gemini AI Icon Suggestions
- When user types mission/vision/value title and details, we can optionally call Gemini AI
- Send a prompt like: "Suggest a Heroicons icon name for: [title] - [details]"
- Gemini returns icon name suggestions
- User can accept or choose a different icon

## Implementation Approach

### Phase 1: Manual Icon Selection (Current)
1. User selects "Icon" as display type
2. User types icon name (e.g., "HeartIcon", "StarIcon")
3. Frontend validates and displays preview
4. Icon name is stored in database

### Phase 2: Icon Picker Component (Recommended)
1. Create an icon picker modal/dropdown
2. Show all available Heroicons with search
3. User clicks to select icon
4. Icon name is automatically filled

### Phase 3: Gemini AI Integration (Optional)
1. Add Gemini API key to backend environment
2. Create endpoint: `POST /api/v1/tenant/public-page/suggest-icon`
3. Send title and details to Gemini
4. Return 3-5 icon name suggestions
5. User can select from suggestions or search manually

## Icon Name Format
- Use Heroicons naming convention: `[Name]Icon`
- Examples: `HeartIcon`, `StarIcon`, `LightBulbIcon`, `SparklesIcon`, `TrophyIcon`
- Frontend will dynamically import: `import { HeartIcon } from '@heroicons/react/24/outline'`

## Database Storage
- Store icon name as string in `iconName` field
- No need to store icon files or URLs
- Frontend handles icon rendering

## Benefits
1. **Lightweight**: No icon files to store
2. **Consistent**: All icons from same library (Heroicons)
3. **Flexible**: Easy to add new icons
4. **AI-Enhanced**: Optional smart suggestions via Gemini

