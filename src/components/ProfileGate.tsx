import { useState, type ReactNode } from "react";

const STORAGE_KEY = "collateral.profile.v1";

export type Profile = "ane" | "thais";

export const PROFILE_LABELS: Record<Profile, string> = {
  ane: "Ane",
  thais: "Thais",
};

export function loadProfile(): Profile | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "ane" || v === "thais" ? v : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch {
    // ignore
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function ProfileGate({
  children,
}: {
  children: (profile: Profile, switchProfile: () => void) => ReactNode;
}) {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());

  function pick(p: Profile) {
    saveProfile(p);
    setProfile(p);
  }

  function switchProfile() {
    if (
      window.confirm(
        "Trocar de perfil? Você poderá editar somente o calendário do perfil selecionado."
      )
    ) {
      clearProfile();
      setProfile(null);
    }
  }

  if (!profile) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <span className="lock-eyebrow">Capas Collateral</span>
          <h1 className="lock-title">Quem é você?</h1>
          <p className="lock-sub">
            Selecione seu perfil. Cada uma edita só o próprio calendário, mas
            vê o da outra. Você pode trocar depois.
          </p>
          <div className="profile-picker">
            <button
              type="button"
              className="profile-picker-button"
              onClick={() => pick("ane")}
            >
              Sou Ane
            </button>
            <button
              type="button"
              className="profile-picker-button"
              onClick={() => pick("thais")}
            >
              Sou Thais
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(profile, switchProfile)}</>;
}
