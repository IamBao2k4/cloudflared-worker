import * as fs from 'fs/promises';
import * as path from 'path';

class AuthService {
    async login(request: any) {
        const { email, password } = request.body as { email: string; password: string };
        if (email === 'tiennt1242@gmail.com' && password === 'tiennt1242@gmail.com') {
            // Generate a token (in a real application, use JWT or similar)
            const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MTFlOGE0N2I0NWIyOTc0YmQ2MTMzYyIsImVtYWlsIjoiYWRtaW4yMDI0QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4yMDI0QGdtYWlsLmNvbSIsInBob25lIjoiODQ1NTkzMzAwNzIiLCJyb2xlX3N5c3RlbSI6ImFkbWluIiwiaWF0IjoxNzUxMzUzMjQ0LCJleHAiOjE3NTE0Mzk2NDR9.LwXXoDQ-kxcdIZfYPkfoAdGELRpbPZ64gQCgP42-lR8';
            return { success: true, accessToken };
        }
        else {
            return { success: false, message: 'Invalid credentials' };
        }
    }

    async register(userData: any) {
        // Implement registration logic
    }

    async getUserProfile(userId?: string) {
        // read json at json\auth.me.json then return it
        try {
            const jsonPath = path.join(process.cwd(), 'json', 'auth.me.json');
            const jsonData = await fs.readFile(jsonPath, 'utf8');
            const userData = JSON.parse(jsonData);
            return userData;
        } catch (error) {
            console.error('Error reading auth.me.json:', error);
            throw new Error('Failed to read user profile data');
        }
    }
}

export const authService = new AuthService();