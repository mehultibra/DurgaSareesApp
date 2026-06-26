import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

window.Capacitor = Capacitor;
window.CapacitorShare = Share;
window.CapacitorFilesystem = Filesystem;
window.CapacitorDirectory = Directory;
window.CapacitorFirebaseAuthentication = FirebaseAuthentication;
