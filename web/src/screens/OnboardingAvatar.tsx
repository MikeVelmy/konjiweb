import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AvatarBuilder } from '../components/AvatarBuilder';
import { Button, Screen, Toast, useToast } from '../components/ui';
import { useSession } from '../data/RepositoryProvider';
import { useDraft } from './onboardingDraft';

export function OnboardingAvatar() {
  const navigate = useNavigate();
  const { draft, patch, reset } = useDraft();
  const { onboard } = useSession();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (!draft.gender || !draft.genderPreference) {
      navigate('/identity', { replace: true });
      return;
    }
    setSaving(true);
    try {
      await onboard({
        country: draft.country,
        gender: draft.gender,
        genderPreference: draft.genderPreference,
        avatar: draft.avatar,
        ageAttested: draft.ageAttested,
      });
      reset();
      navigate('/', { replace: true });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not finish setup.');
      setSaving(false);
    }
  };

  return (
    <Screen>
      <div style={{ height: 16 }} />
      <h1 className="title">This is you now</h1>
      <p className="sub">No photo. Just this, until you are ready.</p>

      <div style={{ height: 24 }} />

      <AvatarBuilder value={draft.avatar} onChange={(avatar) => patch({ avatar })} />

      <div className="spacer" />

      <Button disabled={saving} onClick={finish}>
        {saving ? 'Saving…' : 'Save avatar'}
      </Button>

      <Toast message={toast.message} onDone={toast.clear} />
    </Screen>
  );
}
