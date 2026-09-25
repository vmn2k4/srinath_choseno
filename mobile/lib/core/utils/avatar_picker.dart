import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

/// A photo chosen from the gallery, ready to upload.
typedef PickedAvatar = ({Uint8List bytes, String extension});

/// Thrown-free result of [pickAvatarFromGallery]: either a photo, a
/// user-facing error ("Image must be less than 5MB", same limit as the web's
/// onboarding), or null when the user backed out of the picker.
typedef AvatarPickResult = ({PickedAvatar? photo, String? error});

const _maxAvatarBytes = 5 * 1024 * 1024;

Future<AvatarPickResult?> pickAvatarFromGallery() async {
  final file = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    maxWidth: 1600,
    imageQuality: 88,
  );
  if (file == null) return null;
  final bytes = await file.readAsBytes();
  if (bytes.length > _maxAvatarBytes) {
    return (photo: null, error: 'Image must be less than 5MB');
  }
  final dot = file.path.lastIndexOf('.');
  final extension = dot == -1
      ? 'jpg'
      : file.path.substring(dot + 1).toLowerCase();
  return (photo: (bytes: bytes, extension: extension), error: null);
}
