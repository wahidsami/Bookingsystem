'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { PhotoIcon, XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { tenantApi } from '@/lib/api';

interface MissionVisionValue {
  id: string;
  titleEn: string;
  titleAr: string;
  detailsEn: string;
  detailsAr: string;
  type: 'icon' | 'image';
  iconName?: string;
  imageUrl?: string;
  imageFile?: File;
}

export function AboutUsTab() {
  const t = useTranslations('MyPage.AboutUs');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Our Story
  const [storyTitle, setStoryTitle] = useState('ourStory');
  const [storyEn, setStoryEn] = useState('');
  const [storyAr, setStoryAr] = useState('');

  // Missions
  const [missions, setMissions] = useState<MissionVisionValue[]>([]);

  // Visions
  const [visions, setVisions] = useState<MissionVisionValue[]>([]);

  // Values
  const [values, setValues] = useState<MissionVisionValue[]>([]);

  // Facilities
  const [facilitiesDescriptionEn, setFacilitiesDescriptionEn] = useState('');
  const [facilitiesDescriptionAr, setFacilitiesDescriptionAr] = useState('');
  const [facilitiesImages, setFacilitiesImages] = useState<string[]>([]);
  const [facilitiesImageFiles, setFacilitiesImageFiles] = useState<File[]>([]);

  // Final Word
  const [finalWordTitleEn, setFinalWordTitleEn] = useState('');
  const [finalWordTitleAr, setFinalWordTitleAr] = useState('');
  const [finalWordTextEn, setFinalWordTextEn] = useState('');
  const [finalWordTextAr, setFinalWordTextAr] = useState('');
  const [finalWordType, setFinalWordType] = useState<'image' | 'icon'>('image');
  const [finalWordImageUrl, setFinalWordImageUrl] = useState<string | null>(null);
  const [finalWordImageFile, setFinalWordImageFile] = useState<File | null>(null);
  const [finalWordIconName, setFinalWordIconName] = useState('');

  const storyTitleOptions = [
    { value: 'ourStory', label: t('storyTitleOptions.ourStory') },
    { value: 'aboutUs', label: t('storyTitleOptions.aboutUs') },
    { value: 'whoWeAre', label: t('storyTitleOptions.whoWeAre') },
    { value: 'ourJourney', label: t('storyTitleOptions.ourJourney') },
  ];

  useEffect(() => {
    loadAboutUsData();
  }, []);

  const loadAboutUsData = async () => {
    try {
      setLoading(true);
      const response = await tenantApi.getPublicPageData();
      if (response.success && response.data) {
        const data = response.data.aboutUs || {};
        
        setStoryTitle(data.storyTitle || 'ourStory');
        setStoryEn(data.storyEn || '');
        setStoryAr(data.storyAr || '');
        // Fix mission/vision/value image paths
        const fixImagePaths = (items: any[]) => {
          return items.map((item: any) => {
            if (item.imageUrl && !item.imageUrl.startsWith('http') && !item.imageUrl.startsWith('data:')) {
              item.imageUrl = `http://localhost:5000/uploads/${item.imageUrl}`;
            }
            return item;
          });
        };
        setMissions(fixImagePaths(data.missions || []));
        setVisions(fixImagePaths(data.visions || []));
        setValues(fixImagePaths(data.values || []));
        setFacilitiesDescriptionEn(data.facilitiesDescriptionEn || '');
        setFacilitiesDescriptionAr(data.facilitiesDescriptionAr || '');
        // Fix facilities images paths
        const facilitiesImgs = (data.facilitiesImages || []).map((img: string) => 
          img.startsWith('http') ? img : `http://localhost:5000/uploads/${img}`
        );
        setFacilitiesImages(facilitiesImgs);
        setFinalWordTitleEn(data.finalWordTitleEn || '');
        setFinalWordTitleAr(data.finalWordTitleAr || '');
        setFinalWordTextEn(data.finalWordTextEn || '');
        setFinalWordTextAr(data.finalWordTextAr || '');
        setFinalWordType(data.finalWordType || 'image');
        // Fix final word image path
        setFinalWordImageUrl(data.finalWordImageUrl ? (data.finalWordImageUrl.startsWith('http') ? data.finalWordImageUrl : `http://localhost:5000/uploads/${data.finalWordImageUrl}`) : null);
        setFinalWordIconName(data.finalWordIconName || '');
      }
    } catch (err: any) {
      console.error('Failed to load About Us data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMission = () => {
    setMissions([...missions, {
      id: Date.now().toString(),
      titleEn: '',
      titleAr: '',
      detailsEn: '',
      detailsAr: '',
      type: 'icon',
      iconName: ''
    }]);
  };

  const handleRemoveMission = (id: string) => {
    setMissions(missions.filter(m => m.id !== id));
  };

  const handleUpdateMission = (id: string, field: keyof MissionVisionValue, value: any) => {
    setMissions(missions.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleAddVision = () => {
    setVisions([...visions, {
      id: Date.now().toString(),
      titleEn: '',
      titleAr: '',
      detailsEn: '',
      detailsAr: '',
      type: 'icon',
      iconName: ''
    }]);
  };

  const handleRemoveVision = (id: string) => {
    setVisions(visions.filter(v => v.id !== id));
  };

  const handleUpdateVision = (id: string, field: keyof MissionVisionValue, value: any) => {
    setVisions(visions.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const handleAddValue = () => {
    setValues([...values, {
      id: Date.now().toString(),
      titleEn: '',
      titleAr: '',
      detailsEn: '',
      detailsAr: '',
      type: 'icon',
      iconName: ''
    }]);
  };

  const handleRemoveValue = (id: string) => {
    setValues(values.filter(v => v.id !== id));
  };

  const handleUpdateValue = (id: string, field: keyof MissionVisionValue, value: any) => {
    setValues(values.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const handleFacilitiesImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (facilitiesImages.length + facilitiesImageFiles.length + files.length > 10) {
      setError(t('facilities.maxImages'));
      return;
    }
    setFacilitiesImageFiles([...facilitiesImageFiles, ...files]);
  };

  const handleRemoveFacilitiesImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setFacilitiesImages(facilitiesImages.filter((_, i) => i !== index));
    } else {
      setFacilitiesImageFiles(facilitiesImageFiles.filter((_, i) => i !== index));
    }
  };

  const handleFinalWordImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFinalWordImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFinalWordImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const formData = new FormData();
      // Story
      formData.append('storyTitle', storyTitle);
      formData.append('storyEn', storyEn);
      formData.append('storyAr', storyAr);

      // Missions, Visions, Values - append images separately
      const missionsToSave = missions.map(m => {
        const { imageFile, ...rest } = m;
        return rest;
      });
      missions.forEach((mission, index) => {
        if (mission.type === 'image' && mission.imageFile) {
          formData.append(`missionImage_${mission.id}`, mission.imageFile);
        }
      });
      formData.append('missions', JSON.stringify(missionsToSave));

      const visionsToSave = visions.map(v => {
        const { imageFile, ...rest } = v;
        return rest;
      });
      visions.forEach((vision, index) => {
        if (vision.type === 'image' && vision.imageFile) {
          formData.append(`visionImage_${vision.id}`, vision.imageFile);
        }
      });
      formData.append('visions', JSON.stringify(visionsToSave));

      const valuesToSave = values.map(v => {
        const { imageFile, ...rest } = v;
        return rest;
      });
      values.forEach((value, index) => {
        if (value.type === 'image' && value.imageFile) {
          formData.append(`valueImage_${value.id}`, value.imageFile);
        }
      });
      formData.append('values', JSON.stringify(valuesToSave));

      // Facilities
      formData.append('facilitiesDescriptionEn', facilitiesDescriptionEn);
      formData.append('facilitiesDescriptionAr', facilitiesDescriptionAr);
      formData.append('existingFacilitiesImages', JSON.stringify(facilitiesImages));
      facilitiesImageFiles.forEach((file, index) => {
        formData.append(`facilitiesImages`, file);
      });

      // Final Word
      formData.append('finalWordTitleEn', finalWordTitleEn);
      formData.append('finalWordTitleAr', finalWordTitleAr);
      formData.append('finalWordTextEn', finalWordTextEn);
      formData.append('finalWordTextAr', finalWordTextAr);
      formData.append('finalWordType', finalWordType);
      if (finalWordImageFile) {
        formData.append('finalWordImage', finalWordImageFile);
      }
      if (finalWordImageUrl && !finalWordImageFile) {
        formData.append('existingFinalWordImage', finalWordImageUrl);
      }
      formData.append('finalWordIconName', finalWordIconName);

      await tenantApi.updatePublicPageData(formData);
      setSuccess(t('saved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const renderMissionVisionValue = (
    items: MissionVisionValue[],
    onAdd: () => void,
    onRemove: (id: string) => void,
    onUpdate: (id: string, field: keyof MissionVisionValue, value: any) => void,
    sectionTitle: string
  ) => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {sectionTitle}
          </h3>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <PlusIcon className="w-4 h-4" />
            {t('addNew')}
          </button>
        </div>

        {items.map((item) => (
          <div key={item.id} className="p-4 border border-gray-200 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('item')} #{items.indexOf(item) + 1}</span>
              <button
                onClick={() => onRemove(item.id)}
                className="text-red-600 hover:text-red-700"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('titleEn')}
                </label>
                <input
                  type="text"
                  value={item.titleEn}
                  onChange={(e) => onUpdate(item.id, 'titleEn', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('titleAr')}
                </label>
                <input
                  type="text"
                  value={item.titleAr}
                  onChange={(e) => onUpdate(item.id, 'titleAr', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  style={{ textAlign: 'right' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('detailsEn')}
                </label>
                <textarea
                  value={item.detailsEn}
                  onChange={(e) => onUpdate(item.id, 'detailsEn', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('detailsAr')}
                </label>
                <textarea
                  value={item.detailsAr}
                  onChange={(e) => onUpdate(item.id, 'detailsAr', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  style={{ textAlign: 'right' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('displayType')}
                </label>
                <select
                  value={item.type}
                  onChange={(e) => onUpdate(item.id, 'type', e.target.value as 'icon' | 'image')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="icon">{t('icon')}</option>
                  <option value="image">{t('image')}</option>
                </select>
              </div>

              {item.type === 'icon' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('iconName')} ({t('iconHint')})
                  </label>
                  <input
                    type="text"
                    value={item.iconName || ''}
                    onChange={(e) => onUpdate(item.id, 'iconName', e.target.value)}
                    placeholder="e.g., HeartIcon, StarIcon"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('uploadImage')}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onUpdate(item.id, 'imageFile', file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          onUpdate(item.id, 'imageUrl', reader.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-lg" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Our Story */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        <h3 className="text-md font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('ourStory.title')}
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('ourStory.titleLabel')}
          </label>
          <select
            value={storyTitle}
            onChange={(e) => setStoryTitle(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg"
          >
            {storyTitleOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('ourStory.storyEn')}
            </label>
            <textarea
              value={storyEn}
              onChange={(e) => setStoryEn(e.target.value)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('ourStory.storyAr')}
            </label>
            <textarea
              value={storyAr}
              onChange={(e) => setStoryAr(e.target.value)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              style={{ textAlign: 'right' }}
            />
          </div>
        </div>
      </div>

      {/* Our Mission */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        {renderMissionVisionValue(missions, handleAddMission, handleRemoveMission, handleUpdateMission, t('ourMission.title'))}
      </div>

      {/* Our Vision */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        {renderMissionVisionValue(visions, handleAddVision, handleRemoveVision, handleUpdateVision, t('ourVision.title'))}
      </div>

      {/* Our Values */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        {renderMissionVisionValue(values, handleAddValue, handleRemoveValue, handleUpdateValue, t('ourValues.title'))}
      </div>

      {/* Our Facilities */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        <h3 className="text-md font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('facilities.title')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('facilities.descriptionEn')}
            </label>
            <textarea
              value={facilitiesDescriptionEn}
              onChange={(e) => setFacilitiesDescriptionEn(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('facilities.descriptionAr')}
            </label>
            <textarea
              value={facilitiesDescriptionAr}
              onChange={(e) => setFacilitiesDescriptionAr(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              style={{ textAlign: 'right' }}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('facilities.images')} ({t('facilities.maxImages')})
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {facilitiesImages.map((img, index) => (
              <div key={`existing-${index}`} className="relative">
                <img src={img} alt={`Facility ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => handleRemoveFacilitiesImage(index, true)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            {facilitiesImageFiles.map((file, index) => {
              const url = URL.createObjectURL(file);
              return (
                <div key={`new-${index}`} className="relative">
                  <img src={url} alt={`New ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                  <button
                    onClick={() => handleRemoveFacilitiesImage(index, false)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {facilitiesImages.length + facilitiesImageFiles.length < 10 && (
              <label className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500">
                <PhotoIcon className="w-8 h-8 text-gray-400" />
                <input type="file" accept="image/*" multiple onChange={handleFacilitiesImageChange} className="hidden" />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Final Word */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        <h3 className="text-md font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('finalWord.title')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('finalWord.titleEn')}
            </label>
            <input
              type="text"
              value={finalWordTitleEn}
              onChange={(e) => setFinalWordTitleEn(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('finalWord.titleAr')}
            </label>
            <input
              type="text"
              value={finalWordTitleAr}
              onChange={(e) => setFinalWordTitleAr(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              style={{ textAlign: 'right' }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('finalWord.textEn')}
            </label>
            <textarea
              value={finalWordTextEn}
              onChange={(e) => setFinalWordTextEn(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('finalWord.textAr')}
            </label>
            <textarea
              value={finalWordTextAr}
              onChange={(e) => setFinalWordTextAr(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              style={{ textAlign: 'right' }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('finalWord.displayType')}
            </label>
            <select
              value={finalWordType}
              onChange={(e) => setFinalWordType(e.target.value as 'image' | 'icon')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="image">{t('image')}</option>
              <option value="icon">{t('icon')}</option>
            </select>
          </div>
          {finalWordType === 'image' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('uploadImage')}
              </label>
              <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                {finalWordImageUrl && (
                  <img src={finalWordImageUrl} alt="Final Word" className="w-32 h-32 object-cover rounded-lg" />
                )}
                <label className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
                  {finalWordImageUrl ? t('changeImage') : t('uploadImage')}
                  <input type="file" accept="image/*" onChange={handleFinalWordImageChange} className="hidden" />
                </label>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('iconName')} ({t('iconHint')})
              </label>
              <input
                type="text"
                value={finalWordIconName}
                onChange={(e) => setFinalWordIconName(e.target.value)}
                placeholder="e.g., HeartIcon, StarIcon"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-6 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}

