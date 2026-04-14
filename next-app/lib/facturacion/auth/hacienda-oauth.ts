// ─── Facturación Electrónica CR v4.4 — Hacienda OAuth2 ───────────────────

import { createAdminClient } from "@/lib/supabase-admin";
import { getHaciendaEndpoints } from "../config";
import { decrypt } from "../crypto/encryption";
import type { Ambiente, FEConfig, HaciendaToken } from "../types";

const REFRESH_BUFFER_SECONDS = 60;

interface FeTokenRow {
    branch_id: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    updated_at: string;
}

export async function getHaciendaToken(branchId: string): Promise<HaciendaToken> {
    const supabase = createAdminClient();

    const { data: config, error: configError } = await supabase
        .from("fe_config")
        .select("*")
        .eq("branch_id", branchId)
        .single();

    if (configError || !config) {
        throw new Error(
            `No facturación electrónica configuration found for branch ${branchId}. ` +
                `Ensure fe_config is set up for this branch.`
        );
    }

    const feConfig = config as unknown as FEConfig;

    const { data: tokenRow } = await supabase
        .from("fe_tokens")
        .select("*")
        .eq("branch_id", branchId)
        .single();

    const tokenRowTyped = tokenRow as FeTokenRow | null;

    if (tokenRowTyped) {
        const expiresAt = new Date(tokenRowTyped.expires_at);
        const now = new Date();

        if (expiresAt.getTime() - now.getTime() > REFRESH_BUFFER_SECONDS * 1000) {
            return {
                access_token: tokenRowTyped.access_token,
                refresh_token: tokenRowTyped.refresh_token,
                expires_in: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
                expires_at: expiresAt,
            };
        }

        if (tokenRowTyped.refresh_token) {
            try {
                const refreshed = await refreshHaciendaToken(
                    tokenRowTyped.refresh_token,
                    feConfig.environment
                );
                await storeToken(branchId, refreshed);
                return refreshed;
            } catch {
                // fall through to full auth
            }
        }
    }

    let password = "";
    try {
        if (feConfig.hacienda_password_encrypted) {
            password = decrypt(feConfig.hacienda_password_encrypted);
        }
    } catch {
        console.error("[FE Auth] Failed to decrypt password");
    }

    if (!password) {
        password = process.env.HACIENDA_CLIENT_ID_PASSWORD || "";
        if (!password) {
            throw new Error(
                "No se pudo descifrar la contraseña de ATV y no hay variable de entorno HACIENDA_CLIENT_ID_PASSWORD. Re-guarde las credenciales en Configuración."
            );
        }
    }

    const username = feConfig.hacienda_username || process.env.HACIENDA_CLIENT_ID || "";

    const token = await authenticateWithHacienda(username, password, feConfig.environment);

    try {
        await storeToken(branchId, token);
    } catch {
        console.error("[FE Auth] Failed to store token (non-fatal)");
    }

    return token;
}

export async function authenticateWithHacienda(
    username: string,
    password: string,
    environment: Ambiente
): Promise<HaciendaToken> {
    const endpoints = getHaciendaEndpoints(environment);

    const body = new URLSearchParams({
        grant_type: "password",
        client_id: endpoints.client_id,
        username,
        password,
    });

    const response = await fetch(endpoints.idp_url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(
            `Hacienda authentication failed (${response.status}): ${errorText}. ` +
                `Verify your Hacienda credentials and that the account is active.`
        );
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        expires_at: expiresAt,
    };
}

export async function refreshHaciendaToken(
    refreshToken: string,
    environment: Ambiente
): Promise<HaciendaToken> {
    const endpoints = getHaciendaEndpoints(environment);

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: endpoints.client_id,
        refresh_token: refreshToken,
    });

    const response = await fetch(endpoints.idp_url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(
            `Hacienda token refresh failed (${response.status}): ${errorText}. ` +
                `The refresh token may have expired. A full re-authentication is required.`
        );
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        expires_at: expiresAt,
    };
}

async function storeToken(branchId: string, token: HaciendaToken): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase.from("fe_tokens").upsert(
        {
            branch_id: branchId,
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expires_at: token.expires_at.toISOString(),
            updated_at: new Date().toISOString(),
        },
        { onConflict: "branch_id" }
    );

    if (error) {
        throw new Error(`Failed to store Hacienda token for branch ${branchId}: ${error.message}`);
    }
}
