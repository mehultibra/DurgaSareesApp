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
                            // New Contact -> insert RawContact and Data rows
                            int backRef = ops.size();
                            ops.add(ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
                                .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
                                .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null)
                                .build());

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
                    ret.put("added", addedCount);
                    ret.put("updated", updatedCount);
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

