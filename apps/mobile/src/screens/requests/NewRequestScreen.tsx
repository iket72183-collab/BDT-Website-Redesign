import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RequestAttachment, RequestType, SocialAccount } from '@bdt/shared-types';
import { RNBadge, RNButton, RNCard, RNInput, Icon } from '@/components/ui';
import { api, uploadRequestAttachment } from '@/api/client';
import { palette, radius, space, typography } from '@/styles/appTokens';
import { TYPE_BLURB, TYPE_ICON, TYPE_LABEL } from './requestMeta';
import { PLATFORM_ICON, PLATFORM_LABEL } from '../socialAccounts/socialMeta';

// Single Premium plan = unlimited requests, so no usage/limit UI.
const TYPE_ORDER: RequestType[] = [
  'website_update',
  'social_media',
  'ai_creative',
  'report_request',
  'general',
  'file_upload',
];
const TITLE_MAX = 100;
const DESC_MAX = 1000;

interface CreateBody {
  type: RequestType;
  title: string;
  description: string;
  attachments: RequestAttachment[];
}

export function NewRequestScreen() {
  const qc = useQueryClient();
  const [type, setType] = useState<RequestType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  // Files currently uploading — rendered as chips with a spinner.
  const [uploading, setUploading] = useState<{ id: string; name: string }[]>([]);
  // social_media flow: optional account selection before the details form.
  const [accountStepDone, setAccountStepDone] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SocialAccount | null>(null);

  const socialAccounts = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => api<{ data: SocialAccount[] }>('/api/social-accounts'),
    select: (r) => r.data,
    enabled: type === 'social_media',
  });

  const mutation = useMutation({
    mutationFn: (body: CreateBody) =>
      api('/api/requests', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      router.back();
      Alert.alert('Request submitted!', "We'll be in touch soon.");
    },
    onError: (err) => {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    },
  });

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const MAX_FILES = 5;
  const MAX_BYTES = 10 * 1024 * 1024;

  const uploadOne = async (asset: DocumentPicker.DocumentPickerAsset) => {
    const id = `${asset.uri}-${Date.now()}-${Math.random()}`;
    setUploading((u) => [...u, { id, name: asset.name }]);
    try {
      const result = await uploadRequestAttachment({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      });
      setAttachments((a) => [...a, result]);
    } catch {
      Alert.alert('Upload failed', `Failed to upload ${asset.name}`);
    } finally {
      setUploading((u) => u.filter((x) => x.id !== id));
    }
  };

  const onAddFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'image/*',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    let count = attachments.length + uploading.length;
    for (const asset of result.assets) {
      if (count >= MAX_FILES) {
        Alert.alert('Maximum 5 files allowed');
        break;
      }
      if ((asset.size ?? 0) > MAX_BYTES) {
        Alert.alert('File too large', `${asset.name} is too large (max 10MB)`);
        continue;
      }
      count += 1;
      void uploadOne(asset);
    }
  };

  const canSubmit =
    !!type &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    uploading.length === 0;

  const submit = () => {
    if (!type || !canSubmit) return;
    let finalDescription = description.trim();
    if (selectedAccount) {
      // Simple approach (no schema change): prepend the referenced account.
      const handle = selectedAccount.handle ?? '';
      finalDescription =
        `Account: ${PLATFORM_LABEL[selectedAccount.platform]} ${handle}`.trim() +
        '\n\n' +
        finalDescription;
    }
    mutation.mutate({ type, title: title.trim(), description: finalDescription, attachments });
  };

  // Step 1 — type selector.
  if (!type) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Header onBack={() => router.back()} title="New Request" />
        <Text style={styles.prompt}>What do you need?</Text>
        {TYPE_ORDER.map((t) => (
          <Pressable key={t} onPress={() => setType(t)}>
            <RNCard padding="md" style={styles.typeCard}>
              <View style={styles.typeIcon}>
                <Icon name={TYPE_ICON[t]} size="lg" color={palette.metal.rose} />
              </View>
              <View style={styles.typeBody}>
                <Text style={styles.typeTitle}>{TYPE_LABEL[t]}</Text>
                <Text style={styles.typeBlurb}>{TYPE_BLURB[t]}</Text>
              </View>
              <Icon name="chevron-right" size="sm" color={palette.ink.subtle} />
            </RNCard>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  // Step 1.5 (social_media only) — optional "which account is this for?".
  if (type === 'social_media' && !accountStepDone) {
    const accounts = socialAccounts.data ?? [];
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Header
          onBack={() => {
            setType(null);
            setSelectedAccount(null);
          }}
          title="Social Media"
        />
        <Text style={styles.prompt}>Which account is this for?</Text>
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              setSelectedAccount(a);
              setAccountStepDone(true);
            }}
          >
            <RNCard padding="md" style={styles.typeCard}>
              <View style={styles.typeIcon}>
                <Icon name={PLATFORM_ICON[a.platform]} size="lg" color={palette.metal.rose} />
              </View>
              <View style={styles.typeBody}>
                <Text style={styles.typeTitle}>{PLATFORM_LABEL[a.platform]}</Text>
                <Text style={styles.typeBlurb}>{a.handle ?? 'No handle added'}</Text>
              </View>
              <Icon name="chevron-right" size="sm" color={palette.ink.subtle} />
            </RNCard>
          </Pressable>
        ))}
        <RNButton
          label="Add New Account"
          variant="ghost"
          onPress={() => router.push('/(client)/requests/accounts/new' as never)}
          style={{ marginTop: space[2] }}
        />
        <RNButton
          label="Skip — general request"
          variant="text"
          onPress={() => {
            setSelectedAccount(null);
            setAccountStepDone(true);
          }}
        />
      </ScrollView>
    );
  }

  // Step 2 — details form.
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Header
        onBack={type === 'social_media' ? () => setAccountStepDone(false) : () => setType(null)}
        title={TYPE_LABEL[type]}
      />

      <RNInput
        label="Title"
        value={title}
        onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
        maxLength={TITLE_MAX}
        containerStyle={styles.field}
      />
      <Text style={styles.counter}>
        {title.length}/{TITLE_MAX}
      </Text>

      <RNInput
        label="Description"
        value={description}
        onChangeText={(t) => setDescription(t.slice(0, DESC_MAX))}
        maxLength={DESC_MAX}
        multiline
        numberOfLines={6}
        containerStyle={styles.field}
      />
      <Text style={styles.counter}>
        {description.length}/{DESC_MAX}
      </Text>

      <View style={styles.attachHeader}>
        <Text style={styles.sectionLabel}>ATTACHMENTS</Text>
        <Pressable onPress={onAddFiles} style={styles.addFiles}>
          <Icon name="plus" size="sm" color={palette.metal.rose} />
          <Text style={styles.addFilesLabel}>ADD FILES</Text>
        </Pressable>
      </View>
      {attachments.length === 0 && uploading.length === 0 ? (
        <Text style={styles.attachHint}>Images, PDF, or documents — up to 5 files, 10MB each.</Text>
      ) : (
        <View style={styles.chips}>
          {attachments.map((a, i) => (
            <View key={`${a.path}-${i}`} style={styles.chip}>
              <Icon name="paperclip" size="sm" color={palette.ink.muted} />
              <Text style={styles.chipLabel} numberOfLines={1}>
                {a.name}
              </Text>
              <Pressable onPress={() => removeAttachment(i)} accessibilityLabel={`Remove ${a.name}`}>
                <Icon name="x" size="sm" color={palette.ink.subtle} />
              </Pressable>
            </View>
          ))}
          {uploading.map((u) => (
            <View key={u.id} style={styles.chip}>
              <Icon name="paperclip" size="sm" color={palette.ink.muted} />
              <Text style={styles.chipLabel} numberOfLines={1}>
                {u.name}
              </Text>
              <ActivityIndicator size="small" color={palette.metal.rose} />
            </View>
          ))}
        </View>
      )}

      <RNButton
        label={mutation.isPending ? 'Submitting…' : 'Submit Request'}
        variant="primary"
        disabled={!canSubmit || mutation.isPending}
        loading={mutation.isPending}
        onPress={submit}
        style={styles.submit}
      />
    </ScrollView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={8}>
        <Icon name="chevron-left" size="lg" color={palette.ink.primary} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg.base },
  content: { paddingTop: space[8], paddingHorizontal: space[5], paddingBottom: space[12], gap: space[3] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[4],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.family.displayBold,
    fontSize: typography.size.displayMD,
    color: palette.ink.primary,
  },
  prompt: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodyMD,
    color: palette.ink.muted,
    marginBottom: space[2],
  },
  typeCard: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: palette.bg.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBody: { flex: 1, gap: space[1] },
  typeTitle: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.bodyLG,
    color: palette.ink.primary,
  },
  typeBlurb: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.muted,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(168, 118, 31, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 118, 31, 0.4)',
  },
  limitText: {
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.bodySM,
    color: palette.ink.primary,
  },
  field: { marginTop: space[2] },
  counter: {
    alignSelf: 'flex-end',
    fontFamily: typography.family.body,
    fontSize: typography.size.caption,
    color: palette.ink.subtle,
  },
  attachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[3],
  },
  sectionLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.ink.muted,
  },
  addFiles: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  addFilesLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.label,
    letterSpacing: typography.tracking.label,
    color: palette.metal.rose,
  },
  attachHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.subtle,
  },
  chips: { gap: space[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    backgroundColor: palette.bg.raised,
  },
  chipLabel: {
    flex: 1,
    fontFamily: typography.family.body,
    fontSize: typography.size.bodySM,
    color: palette.ink.primary,
  },
  submit: { marginTop: space[5] },
});
