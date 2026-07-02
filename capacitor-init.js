import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Printer } from '@bcyesil/capacitor-plugin-printer';

window.Capacitor = Capacitor;
window.CapacitorShare = Share;
window.CapacitorFilesystem = Filesystem;
window.CapacitorDirectory = Directory;
window.CapacitorFirebaseAuthentication = FirebaseAuthentication;
window.CapacitorPrinter = Printer;
