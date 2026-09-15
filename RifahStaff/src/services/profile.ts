import api from './api';

export interface UpdateProfileRequest {
    firstName?: string;
    lastName?: string;
    phone?: string;
    bio?: string;
    profileImage?: string;
}

export const updateMe = async (data: UpdateProfileRequest): Promise<any> => {
    const response = await api.patch('/staff/me', data);
    if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to update profile');
    }
    return response.data.data;
};
