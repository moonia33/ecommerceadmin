import {
	fetchJobs,
	fetchMe,
	loginWithCredentials,
	logout,
	ApiError,
	type MeOut
} from '#lib/api/client';

export type AuthState = 'loading' | 'guest' | 'denied' | 'authenticated';

export const auth = $state<{ state: AuthState; user: MeOut | null }>({
	state: 'loading',
	user: null
});

export async function initAuth(): Promise<void> {
	try {
		const me = await fetchMe();
		// Prisijungęs != staff: patikriname ops teises lengvu užklausimu
		await fetchJobs({ page: 1, page_size: 1 });
		auth.user = me;
		auth.state = 'authenticated';
	} catch (error) {
		if (error instanceof ApiError && error.status === 403) {
			auth.state = 'denied';
			return;
		}
		if (error instanceof ApiError && error.status === 401) {
			auth.state = 'guest';
			return;
		}
		// Backend nepasiekiamas – rodome prisijungimo ekraną su klaida
		auth.state = 'guest';
		throw error;
	}
}

export async function signIn(email: string, password: string): Promise<void> {
	await loginWithCredentials({ email, password });
	await initAuth();
}

export async function signOut(): Promise<void> {
	try {
		await logout();
	} catch {
		// Ignoruojame – sesija galėjo jau baigtis
	}
	auth.user = null;
	auth.state = 'guest';
}
