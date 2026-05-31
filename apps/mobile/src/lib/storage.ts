import * as SecureStore from 'expo-secure-store';

// Wrapper so we can swap to AsyncStorage on web if we ever ship a web build.
export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  delete: (key: string) => SecureStore.deleteItemAsync(key),
};
