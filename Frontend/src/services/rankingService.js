import api from './api';

export const getRanking = async (limit = 100) => {
    try {
        const response = await api.get('/ranking/', {
            params: { limit }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch ranking:', error);
        throw error;
    }
};

export const getMyRanking = async () => {
    try {
        const response = await api.get('/ranking/me/');
        return response.data;
    } catch (error) {
        console.error('Failed to fetch my ranking:', error);
        throw error;
    }
};
