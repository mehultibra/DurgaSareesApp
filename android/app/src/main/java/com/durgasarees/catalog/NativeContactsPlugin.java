package com.durgasarees.catalog;

import android.Manifest;
import android.content.ContentProviderOperation;
import android.database.Cursor;
import android.provider.ContactsContract;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(
    name = "NativeContacts",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS }, alias = "contacts")
    }
)
public class NativeContactsPlugin extends Plugin {

    @PluginMethod
    public void syncBatch(PluginCall call) {
        try {
            if (getPermissionState("contacts") != PermissionState.GRANTED) {
                requestPermissionForAlias("contacts", call, "contactsPermsCallback");
                return;
            }

            JSArray items = call.getArray("contacts");
            if (items == null || items.length() == 0) {
                JSObject ret = new JSObject();
                ret.put("added", 0);
                ret.put("updated", 0);
                call.resolve(ret);
                return;
            }

            new Thread(() -> {
                try {
                    String targetAccountType = null;
                    String targetAccountName = null;
                    Long myContactsGroupId = null;

                    // 1. Detect target primary visible account (Google preferred, then Samsung)
                    Cursor actCursor = null;
                    try {
                        actCursor = getContext().getContentResolver().query(
                            ContactsContract.RawContacts.CONTENT_URI,
                            new String[]{ ContactsContract.RawContacts.ACCOUNT_TYPE, ContactsContract.RawContacts.ACCOUNT_NAME },
                            ContactsContract.RawContacts.ACCOUNT_TYPE + " IS NOT NULL AND " + ContactsContract.RawContacts.DELETED + "=0",
                            null,
                            null
                        );
                        if (actCursor != null) {
                            int typeIdx = actCursor.getColumnIndex(ContactsContract.RawContacts.ACCOUNT_TYPE);
                            int nameIdx = actCursor.getColumnIndex(ContactsContract.RawContacts.ACCOUNT_NAME);
                            String fallbackType = null;
                            String fallbackName = null;

                            while (actCursor.moveToNext()) {
                                String at = actCursor.getString(typeIdx);
                                String an = actCursor.getString(nameIdx);
                                if (at != null && !at.trim().isEmpty() && an != null && !an.trim().isEmpty()) {
                                    if ("com.google".equalsIgnoreCase(at)) {
                                        targetAccountType = at;
                                        targetAccountName = an;
                                        break; // Preferred
                                    } else if (at.toLowerCase().contains("sec.contact") || at.toLowerCase().contains("samsung")) {
                                        if (targetAccountType == null) {
                                            targetAccountType = at;
                                            targetAccountName = an;
                                        }
                                    } else if (fallbackType == null) {
                                        fallbackType = at;
                                        fallbackName = an;
                                    }
                                }
                            }
                            if (targetAccountType == null && fallbackType != null) {
                                targetAccountType = fallbackType;
                                targetAccountName = fallbackName;
                            }
                        }
                    } catch (Throwable t) {
                        // Ignore
                    } finally {
                        if (actCursor != null) {
                            try { actCursor.close(); } catch (Throwable ignored) {}
                        }
                    }

                    // 2. Locate My Contacts group for the account so contacts display in main list
                    if (targetAccountType != null && targetAccountName != null) {
                        Cursor grpCursor = null;
                        try {
                            grpCursor = getContext().getContentResolver().query(
                                ContactsContract.Groups.CONTENT_URI,
                                new String[]{ ContactsContract.Groups._ID, ContactsContract.Groups.TITLE, ContactsContract.Groups.AUTO_ADD },
                                ContactsContract.Groups.ACCOUNT_TYPE + "=? AND " + ContactsContract.Groups.ACCOUNT_NAME + "=? AND " + ContactsContract.Groups.DELETED + "=0",
                                new String[]{ targetAccountType, targetAccountName },
                                null
                            );
                            if (grpCursor != null) {
                                int idIdx = grpCursor.getColumnIndex(ContactsContract.Groups._ID);
                                int titleIdx = grpCursor.getColumnIndex(ContactsContract.Groups.TITLE);
                                int autoAddIdx = grpCursor.getColumnIndex(ContactsContract.Groups.AUTO_ADD);

                                while (grpCursor.moveToNext()) {
                                    long gid = grpCursor.getLong(idIdx);
                                    String title = (titleIdx >= 0) ? grpCursor.getString(titleIdx) : "";
                                    int autoAdd = (autoAddIdx >= 0) ? grpCursor.getInt(autoAddIdx) : 0;

                                    if (autoAdd != 0 || (title != null && (title.contains("My Contacts") || title.equalsIgnoreCase("System Group: My Contacts")))) {
                                        myContactsGroupId = gid;
                                        break;
                                    } else if (myContactsGroupId == null) {
                                        myContactsGroupId = gid;
                                    }
                                }
                            }
                        } catch (Throwable t) {
                            // Ignore
                        } finally {
                            if (grpCursor != null) {
                                try { grpCursor.close(); } catch (Throwable ignored) {}
                            }
                        }
                    }

                    Map<String, Long> existingPhoneToRawId = new HashMap<>();
                    Map<Long, Set<String>> rawIdToExistingNumbers = new HashMap<>();

                    Cursor cursor = null;
                    try {
                        cursor = getContext().getContentResolver().query(
                            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                            new String[]{ ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.RAW_CONTACT_ID },
                            null,
                            null,
                            null
                        );
                        if (cursor != null) {
                            int numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                            int rawIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.RAW_CONTACT_ID);
                            while (cursor.moveToNext()) {
                                String num = cursor.getString(numIdx);
                                long rawId = cursor.getLong(rawIdx);
                                if (num != null) {
                                    String clean10 = num.replaceAll("\\D", "");
                                    if (clean10.length() >= 10) {
                                        clean10 = clean10.substring(clean10.length() - 10);
                                        existingPhoneToRawId.put(clean10, rawId);
                                        Set<String> set = rawIdToExistingNumbers.get(rawId);
                                        if (set == null) {
                                            set = new HashSet<>();
                                            rawIdToExistingNumbers.put(rawId, set);
                                        }
                                        set.add(clean10);
                                    }
                                }
                            }
                        }
                    } catch (Throwable t) {
                        // Ignore cursor error
                    } finally {
                        if (cursor != null) {
                            try { cursor.close(); } catch (Throwable ignored) {}
                        }
                    }

                    ArrayList<ContentProviderOperation> ops = new ArrayList<>();
                    int addedCount = 0;
                    int updatedCount = 0;

                    for (int i = 0; i < items.length(); i++) {
                        JSONObject item = items.optJSONObject(i);
                        if (item == null) continue;

                        String name = item.optString("name", "");
                        String org = item.optString("org", "");
                        JSONArray phones = item.optJSONArray("phones");

                        List<String> cleanPhones = new ArrayList<>();
                        if (phones != null) {
                            for (int pi = 0; pi < phones.length(); pi++) {
                                String p = phones.optString(pi, "");
                                String p10 = p.replaceAll("\\D", "");
                                if (p10.length() >= 10) {
                                    p10 = p10.substring(p10.length() - 10);
                                    if (!cleanPhones.contains(p10)) {
                                        cleanPhones.add(p10);
                                    }
                                }
                            }
                        }
                        if (cleanPhones.isEmpty()) continue;

                        Long matchedRawId = null;
                        for (String p10 : cleanPhones) {
                            if (existingPhoneToRawId.containsKey(p10)) {
                                matchedRawId = existingPhoneToRawId.get(p10);
                                break;
                            }
                        }

                        if (matchedRawId != null) {
                            // Existing Contact Found -> rawId
                            Set<String> existingNumbers = rawIdToExistingNumbers.get(matchedRawId);
                            if (existingNumbers == null) {
                                existingNumbers = new HashSet<>();
                                rawIdToExistingNumbers.put(matchedRawId, existingNumbers);
                            }
                            boolean updatedAny = false;
                            for (String p10 : cleanPhones) {
                                if (!existingNumbers.contains(p10)) {
                                    ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                                        .withValue(ContactsContract.Data.RAW_CONTACT_ID, matchedRawId)
                                        .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                                        .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, "+91" + p10)
                                        .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_WORK)
                                        .build());
                                    existingNumbers.add(p10);
                                    existingPhoneToRawId.put(p10, matchedRawId);
                                    updatedAny = true;
                                }
                            }
                            if (updatedAny) updatedCount++;
                        } else {
                            // New Contact -> insert RawContact with detected account and Data rows
                            int backRef = ops.size();
                            ContentProviderOperation.Builder rawBuilder = ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI);
                            if (targetAccountType != null && targetAccountName != null) {
                                rawBuilder.withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, targetAccountType);
                                rawBuilder.withValue(ContactsContract.RawContacts.ACCOUNT_NAME, targetAccountName);
                            } else {
                                rawBuilder.withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null);
                                rawBuilder.withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null);
                            }
                            ops.add(rawBuilder.build());

                            ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, backRef)
                                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                                .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name)
                                .build());

                            if (org != null && !org.trim().isEmpty()) {
                                ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, backRef)
                                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE)
                                    .withValue(ContactsContract.CommonDataKinds.Organization.COMPANY, org.trim())
                                    .build());
                            }

                            if (myContactsGroupId != null) {
                                ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, backRef)
                                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.GroupMembership.CONTENT_ITEM_TYPE)
                                    .withValue(ContactsContract.CommonDataKinds.GroupMembership.GROUP_ROW_ID, myContactsGroupId)
                                    .build());
                            }

                            for (int pi = 0; pi < cleanPhones.size(); pi++) {
                                String p10 = cleanPhones.get(pi);
                                ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, backRef)
                                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                                    .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, "+91" + p10)
                                    .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, pi == 0 ? ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE : ContactsContract.CommonDataKinds.Phone.TYPE_WORK)
                                    .build());
                            }
                            addedCount++;
                        }

                        if (ops.size() >= 150) {
                            try {
                                getContext().getContentResolver().applyBatch(ContactsContract.AUTHORITY, ops);
                            } catch (Throwable t) {
                                // Ignore partial batch error and proceed
                            }
                            ops.clear();
                        }
                    }

                    if (!ops.isEmpty()) {
                        try {
                            getContext().getContentResolver().applyBatch(ContactsContract.AUTHORITY, ops);
                        } catch (Throwable t) {
                            // Ignore
                        }
                        ops.clear();
                    }

                    JSObject ret = new JSObject();
                    ret.put("totalReceived", items.length());
                    ret.put("added", addedCount);
                    ret.put("updated", updatedCount);
                    ret.put("accountUsed", targetAccountType != null ? (targetAccountName + " (" + targetAccountType + ")") : "Device Default");
                    call.resolve(ret);
                } catch (Throwable t) {
                    call.reject("Native contact sync failed: " + t.getMessage());
                }
            }).start();

        } catch (Throwable t) {
            call.reject("syncBatch error: " + t.getMessage());
        }
    }

    @PermissionCallback
    private void contactsPermsCallback(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            syncBatch(call);
        } else {
            call.reject("Permission denied: READ_CONTACTS / WRITE_CONTACTS");
        }
    }
}

