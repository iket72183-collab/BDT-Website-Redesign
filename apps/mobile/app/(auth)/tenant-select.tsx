import { View, Text, TextInput, Pressable } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTenantStore } from '@/stores/tenant';

// Mobile entry point: user types or scans a tenant slug ("acme-gym"). We
// persist it and route to login. Future: deep links like bdt://t/acme-gym.
export default function TenantSelect() {
  const [slug, setSlug] = useState('');
  const setTenantSlug = useTenantStore((s) => s.setSlug);

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>Find your business</Text>
      <TextInput
        value={slug}
        onChangeText={setSlug}
        autoCapitalize="none"
        placeholder="business-slug"
        style={{ borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 16 }}
      />
      <Pressable
        onPress={() => {
          setTenantSlug(slug.trim());
          router.push('/(auth)/login');
        }}
        style={{ backgroundColor: '#000', padding: 14, borderRadius: 8, marginTop: 16 }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Continue</Text>
      </Pressable>
    </View>
  );
}
