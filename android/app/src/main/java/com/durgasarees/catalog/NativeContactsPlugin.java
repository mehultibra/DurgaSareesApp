package com.durgasarees.catalog;

import android.Manifest;
import android.accounts.Account;
import android.accounts.AccountManager;
import android.content.ContentProviderOperation;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
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
    public static final String ACCOUNT_TYPE = "com.durgasarees.catalog";
    public static final String ACCOUNT_NAME = "Durga Sarees ERP";
    private static volatile boolean sGmailCleaned = false;

    private void ensureDurgaAccount() {
        try {
            AccountManager am = AccountManager.get(getContext());
            Account erpAccount = new Account(ACCOUNT_NAME, ACCOUNT_TYPE);
            am.addAccountExplicitly(erpAccount, null, null);

            ContentValues cv = new ContentValues();
            cv.put(ContactsContract.Settings.ACCOUNT_NAME, ACCOUNT_NAME);
            cv.put(ContactsContract.Settings.ACCOUNT_TYPE, ACCOUNT_TYPE);
            cv.put(ContactsContract.Settings.UNGROUPED_VISIBLE, 1);
            cv.put(ContactsContract.Settings.SHOULD_SYNC, 0);
            getContext().getContentResolver().insert(ContactsContract.Settings.CONTENT_URI, cv);
        } catch (Throwable ignored) {}
    }

    private int cleanGmailErpContacts() {
        int deleted = 0;
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(
                ContactsContract.RawContacts.CONTENT_URI,
                new String[]{ ContactsContract.RawContacts._ID },
                ContactsContract.RawContacts.ACCOUNT_TYPE + " = 'com.google' AND " +
                ContactsContract.RawContacts.DELETED + " = 0 AND (" +
                ContactsContract.RawContacts.DISPLAY_NAME_PRIMARY + " LIKE '%[%' OR " +
                ContactsContract.RawContacts.DISPLAY_NAME_PRIMARY + " LIKE '%(Ag:%')",
                null,
                null
            );
            if (c != null) {
                int idIdx = c.getColumnIndex(ContactsContract.RawContacts._ID);
                ArrayList<ContentProviderOperation> deleteOps = new ArrayList<>();
                Uri uriWithSync = ContactsContract.RawContacts.CONTENT_URI.buildUpon()
                    .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
                    .build();

                while (c.moveToNext()) {
                    long rawId = c.getLong(idIdx);
                    deleteOps.add(ContentProviderOperation.newDelete(uriWithSync)
                        .withSelection(ContactsContract.RawContacts._ID + " = ?", new String[]{ String.valueOf(rawId) })
                        .build());
                    deleted++;

                    if (deleteOps.size() >= 100) {
                        try {
                            getContext().getContentResolver().applyBatch(ContactsContract.AUTHORITY, deleteOps);
                        } catch (Throwable ignored) {}
                        deleteOps.clear();
                    }
                }
                if (!deleteOps.isEmpty()) {
                    try {
                        getContext().getContentResolver().applyBatch(ContactsContract.AUTHORITY, deleteOps);
                    } catch (Throwable ignored) {}
                    deleteOps.clear();
                }
            }
        } catch (Throwable ignored) {
        } finally {
            if (c != null) {
                try { c.close(); } catch (Throwable ignored) {}
            }
        }
        return deleted;
    }

    @PluginMethod
    public void cleanGmailContacts(PluginCall call) {
        try {
            if (getPermissionState("contacts") != PermissionState.GRANTED) {
                requestPermissionForAlias("contacts", call, "contactsPermsCallback");
                return;
            }
            new Thread(() -> {
                int count = cleanGmailErpContacts();
                JSObject ret = new JSObject();
                ret.put("deleted", count);
                call.resolve(ret);
            }).start();
        } catch (Throwable t) {
            call.reject("cleanGmailContacts error: " + t.getMessage());
        }
    }

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
                    // 1. Ensure dedicated "Durga Sarees ERP" account exists
                    ensureDurgaAccount();

                    // 2. Perform one-time cleanup of legacy ERP contacts from com.google
                    int cleanedCount = 0;
                    if (!sGmailCleaned) {
                        cleanedCount = cleanGmailErpContacts();
                        sGmailCleaned = true;
                    }

                    // 3. Map existing contacts inside the "Durga Sarees ERP" account
                    Map<String, Long> existingPhoneToRawId = new HashMap<>();
                    Map<Long, Set<String>> rawIdToExistingNumbers = new HashMap<>();

                    Cursor cursor = null;
                    try {
                        cursor = getContext().getContentResolver().query(
                            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                            new String[]{ ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.RAW_CONTACT_ID },
                            ContactsContract.RawContacts.ACCOUNT_TYPE + " = ?",
                            new String[]{ ACCOUNT_TYPE },
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
                    } catch (Throwable ignored) {
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
                            // Existing Contact in Durga Sarees ERP -> update phone numbers if missing
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
                            // New Contact -> insert exclusively into Durga Sarees ERP account
                            int backRef = ops.size();
                            ContentProviderOperation.Builder rawBuilder = ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI);
                            rawBuilder.withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, ACCOUNT_TYPE);
                            rawBuilder.withValue(ContactsContract.RawContacts.ACCOUNT_NAME, ACCOUNT_NAME);
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
                            } catch (Throwable ignored) {}
                            ops.clear();
                        }
                    }

                    if (!ops.isEmpty()) {
                        try {
                            getContext().getContentResolver().applyBatch(ContactsContract.AUTHORITY, ops);
                        } catch (Throwable ignored) {}
                        ops.clear();
                    }

                    JSObject ret = new JSObject();
                    ret.put("totalReceived", items.length());
                    ret.put("added", addedCount);
                    ret.put("updated", updatedCount);
                    ret.put("gmailCleaned", cleanedCount);
                    ret.put("accountUsed", "Durga Sarees ERP (" + ACCOUNT_TYPE + ")");
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
