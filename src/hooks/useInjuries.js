import { useApi } from './useApi';
import { api } from '../utils/api';

/**
 * Kaikkien joukkueiden poissaolot. Palvelin välimuistittaa listan, joten
 * haku on kevyt. null = haku kesken tai epäonnistui.
 */
export function useInjuries() {
    const { data } = useApi((signal) => api.injuries({ signal }), []);
    return data?.rows ?? null;
}
