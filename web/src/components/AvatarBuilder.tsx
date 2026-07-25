import { outfits, skins, type AvatarConfig } from '../domain/avatar';
import { avatarColors } from '../theme/tokens';
import { PixelAvatar } from './PixelAvatar';

const OUTFIT_COLORS = ['#262320', '#3A352F', '#7A1E19', '#1F3A5F', '#2F4F3A', '#4A2F5F'];

/** Shared by onboarding and the profile screen so editing works identically. */
export function AvatarBuilder({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}) {
  return (
    <div>
      <div className="avatar-frame avatar-hero" style={{ marginBottom: 24 }}>
        <PixelAvatar config={value} size={110} />
      </div>

      <p className="label">Shape</p>
      <div className="chip-row" role="radiogroup" aria-label="Avatar shape">
        {skins.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip"
            role="radio"
            aria-checked={value.skin === s.id}
            onClick={() => onChange({ ...value, skin: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="label">Colour</p>
      <div className="swatch-row" role="radiogroup" aria-label="Avatar colour">
        {avatarColors.map((c) => (
          <button
            key={c.id}
            type="button"
            className="swatch"
            role="radio"
            aria-checked={value.color === c.hex}
            aria-label={c.id}
            onClick={() => onChange({ ...value, color: c.hex })}
          >
            <span style={{ background: c.hex }} />
          </button>
        ))}
      </div>

      <p className="label">Outfit</p>
      <div className="chip-row" role="radiogroup" aria-label="Outfit">
        {outfits.map((o) => (
          <button
            key={o.id}
            type="button"
            className="chip"
            role="radio"
            aria-checked={value.outfit === o.id}
            onClick={() => onChange({ ...value, outfit: o.id })}
          >
            {o.label}
          </button>
        ))}
      </div>

      <p className="label">Outfit colour</p>
      <div className="swatch-row" role="radiogroup" aria-label="Outfit colour">
        {OUTFIT_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            className="swatch"
            role="radio"
            aria-checked={value.outfitColor === hex}
            aria-label={`Outfit colour ${hex}`}
            onClick={() => onChange({ ...value, outfitColor: hex })}
          >
            <span style={{ background: hex }} />
          </button>
        ))}
      </div>
    </div>
  );
}
