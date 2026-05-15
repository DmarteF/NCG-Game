import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ZoomableImageModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Pressable onPress={onClose} style={styles.close} testID="image-preview-close">
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} maximumZoomScale={5} minimumZoomScale={1} centerContent bouncesZoom>
          {uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : null}
        </ScrollView>
        <Pressable onPress={onClose} style={styles.footerClose}>
          <Text style={styles.footerText}>Fechar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, alignSelf: 'stretch' },
  content: { minHeight: '100%', alignItems: 'center', justifyContent: 'center', padding: 20 },
  image: { width: '100%', height: '86%' },
  close: { position: 'absolute', top: 42, right: 20, zIndex: 3, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  footerClose: { position: 'absolute', bottom: 34, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', zIndex: 3 },
  footerText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
