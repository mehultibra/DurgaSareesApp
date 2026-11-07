package com.durgasarees.catalog;

import android.Manifest;
import android.accounts.Account;
import android.accounts.AccountManager;
import android.content.ContentProviderOperation;
import android.content.ContentUris;
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
    private String mLastBatchError = null;

    private int executeBatchSafely(ArrayList<ContentProviderOperation> ops, int newContactsInBatch) {
        if (ops == null || ops.isEmpty()) return 0;
        try {
            getContext().getContentResolver().applyBatch(ContactsContract.AUTHORITY, ops);
            return newContactsInBatch;
        } catch (Throwable t1) {
            try {
                ArrayList<ContentProviderOperation> fallbackOps = new ArrayList<>();
                for (ContentProviderOperation op : ops) {
                    if (op.toString().contains(ContactsContract.CommonDataKinds.GroupMembership.CONTENT_ITEM_TYPE)) {
                        continue;
                    }
                    fallbackOps.add(op);
                }
                if (!fallbackOps.isEmpty()) {
                    getContext().getContentResolver().applyBatch(ContactsContract.AUTHORITY, fallbackOps);
                    return newContactsInBatch;
                }
            } catch (Throwable t2) {
                mLastBatchError = t2.getMessage();
            }
            if (mLastBatchError == null) {
                mLastBatchError = t1.getMessage();
            }
            return 0;
        }
    }

    private static class AccountInfo {
        final String accountName;
        final String accountType;
        final long groupId;

        AccountInfo(String accountName, String accountType, long groupId) {
            this.accountName = accountName;
            this.accountType = accountType;
            this.groupId = groupId;
        }
    }

    private AccountInfo ensureDurgaAccount() {
        String targetName = ACCOUNT_NAME;
        String targetType = ACCOUNT_TYPE;
        try {
            AccountManager am = AccountManager.get(getContext());
            try {
                Account erpAccount = new Account(ACCOUNT_NAME, ACCOUNT_TYPE);
                am.addAccountExplicitly(erpAccount, null, null);
                android.content.ContentResolver.setIsSyncable(erpAccount, ContactsContract.AUTHORITY, 1);
                android.content.ContentResolver.setSyncAutomatically(erpAccount, ContactsContract.AUTHORITY, false);
            } catch (Throwable ignored) {}

            Account[] accts = null;
            try {
                accts = am.getAccountsByType(ACCOUNT_TYPE);
            } catch (Throwable ignored) {}

            boolean customAccountValid = false;
            if (accts != null) {
                for (Account a : accts) {
                    if (ACCOUNT_NAME.equals(a.name)) {
                        customAccountValid = true;
                        break;
                    }
                }
            }

            if (!customAccountValid) {
                // Fallback: Samsung local phone account or device default
                Account[] secAccts = null;
                try {
                    secAccts = am.getAccountsByType("vnd.sec.contact.phone");
                } catch (Throwable ignored) {}
                if (secAccts != null && secAccts.length > 0) {
                    targetType = "vnd.sec.contact.phone";
                    targetName = secAccts[0].name != null ? secAccts[0].name : "Phone";
                } else {
                    targetName = null;
                    targetType = null;
                }
            }

            // Both update and insert into ContactsContract.Settings
            if (targetType != null && targetName != null) {
                ContentValues cv = new ContentValues();
                cv.put(ContactsContract.Settings.ACCOUNT_NAME, targetName);
                cv.put(ContactsContract.Settings.ACCOUNT_TYPE, targetType);
                cv.put(ContactsContract.Settings.UNGROUPED_VISIBLE, 1);
                cv.put(ContactsContract.Settings.SHOULD_SYNC, 1);
                try {
                    int updated = getContext().getContentResolver().update(
                        ContactsContract.Settings.CONTENT_URI,
                        cv,
                        ContactsContract.Settings.ACCOUNT_NAME + " = ? AND " + ContactsContract.Settings.ACCOUNT_TYPE + " = ?",
                        new String[]{ targetName, targetType }
                    );
                    if (updated == 0) {
                        getContext().getContentResolver().insert(ContactsContract.Settings.CONTENT_URI, cv);
                    }
                } catch (Throwable ignored) {}
            }

            // Ensure visible Contact Group exists
            long groupId = -1;
            if (targetType != null && targetName != null) {
                Cursor gc = null;
                try {
                    gc = getContext().getContentResolver().query(
                        ContactsContract.Groups.CONTENT_URI,
                        new String[]{ ContactsContract.Groups._ID },
                        ContactsContract.Groups.ACCOUNT_NAME + " = ? AND " +
                        ContactsContract.Groups.ACCOUNT_TYPE + " = ? AND " +
                        ContactsContract.Groups.TITLE + " = ? AND " +
                        ContactsContract.Groups.DELETED + " = 0",
                        new String[]{ targetName, targetType, "Durga Sarees ERP" },
                        null
                    );
                    if (gc != null && gc.moveToFirst()) {
                        int gIdx = gc.getColumnIndex(ContactsContract.Groups._ID);
                        if (gIdx >= 0) groupId = gc.getLong(gIdx);
                    }
                } catch (Throwable ignored) {
                } finally {
                    if (gc != null) {
                        try { gc.close(); } catch (Throwable ignored) {}
                    }
                }

                if (groupId <= 0) {
                    try {
                        ContentValues gv = new ContentValues();
                        gv.put(ContactsContract.Groups.ACCOUNT_NAME, targetName);
                        gv.put(ContactsContract.Groups.ACCOUNT_TYPE, targetType);
                        gv.put(ContactsContract.Groups.TITLE, "Durga Sarees ERP");
                        gv.put(ContactsContract.Groups.GROUP_VISIBLE, 1);
                        gv.put(ContactsContract.Groups.AUTO_ADD, 1);
                        Uri gUri = ContactsContract.Groups.CONTENT_URI.buildUpon()
                            .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
                            .build();
                        Uri insUri = getContext().getContentResolver().insert(gUri, gv);
                        if (insUri != null) {
                            groupId = ContentUris.parseId(insUri);
                        }
                    } catch (Throwable ignored) {}
                }
            }

            return new AccountInfo(targetName, targetType, groupId);
        } catch (Throwable ignored) {
            return new AccountInfo(targetName, targetType, -1);
        }
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
                    // 1. Ensure dedicated "Durga Sarees ERP" account exists and get group
                    AccountInfo acctInfo = ensureDurgaAccount();
                    String targetAccountName = acctInfo.accountName;
                    String targetAccountType = acctInfo.accountType;
                    long groupId = acctInfo.groupId;

                    // 2. Perform one-time cleanup of legacy ERP contacts from com.google
                    int cleanedCount = 0;
                    if (!sGmailCleaned) {
                        cleanedCount = cleanGmailErpContacts();
                        sGmailCleaned = true;
                    }

                    // 3. Map existing contacts inside the target account
                    Map<String, Long> existingPhoneToRawId = new HashMap<>();
                    Map<Long, Set<String>> rawIdToExistingNumbers = new HashMap<>();

                    String querySelection = (targetAccountType != null)
                        ? (ContactsContract.RawContacts.ACCOUNT_TYPE + " = ? AND " + ContactsContract.RawContacts.DELETED + " = 0")
                        : (ContactsContract.RawContacts.ACCOUNT_TYPE + " IS NULL AND " + ContactsContract.RawContacts.DELETED + " = 0");
                    String[] queryArgs = (targetAccountType != null) ? new String[]{ targetAccountType } : null;

                    Cursor cursor = null;
                    try {
                        cursor = getContext().getContentResolver().query(
                            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                            new String[]{ ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.RAW_CONTACT_ID },
                            querySelection,
                            queryArgs,
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
                    ArrayList<ContentProviderOperation> groupOps = new ArrayList<>();
                    Set<String> seenInThisBatch = new HashSet<>();
                    int addedCount = 0;
                    int updatedCount = 0;
                    int pendingNewInBatch = 0;

                    Uri rawUriWithSync = ContactsContract.RawContacts.CONTENT_URI.buildUpon()
                        .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
                        .build();
                    Uri dataUriWithSync = ContactsContract.Data.CONTENT_URI.buildUpon()
                        .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
                        .build();

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

                        // Deduplicate duplicate party accounts sharing phone numbers in the same batch
                        boolean alreadySeen = false;
                        for (String p10 : cleanPhones) {
                            if (seenInThisBatch.contains(p10)) {
                                alreadySeen = true;
                                break;
                            }
                        }
                        if (alreadySeen) continue;
                        seenInThisBatch.addAll(cleanPhones);

                        Long matchedRawId = null;
                        for (String p10 : cleanPhones) {
                            if (existingPhoneToRawId.containsKey(p10)) {
                                matchedRawId = existingPhoneToRawId.get(p10);
                                break;
                            }
                        }

                        if (matchedRawId != null) {
                            // Existing Contact in account -> update phone numbers if missing
                            Set<String> existingNumbers = rawIdToExistingNumbers.get(matchedRawId);
                            if (existingNumbers == null) {
                                existingNumbers = new HashSet<>();
                                rawIdToExistingNumbers.put(matchedRawId, existingNumbers);
                            }
                            boolean updatedAny = false;
                            for (String p10 : cleanPhones) {
                                if (!existingNumbers.contains(p10)) {
                                    ops.add(ContentProviderOperation.newInsert(dataUriWithSync)
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
                            // New Contact -> insert with CALLER_IS_SYNCADAPTER
                            int backRef = ops.size();
                            ContentProviderOperation.Builder rawBuilder = ContentProviderOperation.newInsert(rawUriWithSync);
                            if (targetAccountType != null && targetAccountName != null) {
                                rawBuilder.withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, targetAccountType);
                                rawBuilder.withValue(ContactsContract.RawContacts.ACCOUNT_NAME, targetAccountName);
                            }
                            ops.add(rawBuilder.build());

                            ops.add(ContentProviderOperation.newInsert(dataUriWithSync)
                                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, backRef)
                                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                                .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name)
                                .build());

                            if (org != null && !org.trim().isEmpty()) {
                                ops.add(ContentProviderOperation.newInsert(dataUriWithSync)
                                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, backRef)
                                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE)
                                    .withValue(ContactsContract.CommonDataKinds.Organization.COMPANY, org.trim())
                                    .build());
                            }

                            for (int pi = 0; pi < cleanPhones.size(); pi++) {
                                String p10 = cleanPhones.get(pi);
                                ops.add(ContentProviderOperation.newInsert(dataUriWithSync)
                                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, backRef)
                                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                                    .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, "+91" + p10)
                                    .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, pi == 0 ? ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE : ContactsContract.CommonDataKinds.Phone.TYPE_WORK)
                                    .build());
                            }

                            // Attach to visible Group if available (appended at tail of batch)
                            if (groupId > 0) {
                                groupOps.add(ContentProviderOperation.newInsert(dataUriWithSync)
                                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, backRef)
                                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.GroupMembership.CONTENT_ITEM_TYPE)
                                    .withValue(ContactsContract.CommonDataKinds.GroupMembership.GROUP_ROW_ID, groupId)
                                    .build());
                            }

                            pendingNewInBatch++;
                        }

                        if (ops.size() >= 120) {
                            ops.addAll(groupOps);
                            groupOps.clear();
                            addedCount += executeBatchSafely(ops, pendingNewInBatch);
                            ops.clear();
                            pendingNewInBatch = 0;
                        }
                    }

                    if (!ops.isEmpty()) {
                        ops.addAll(groupOps);
                        groupOps.clear();
                        addedCount += executeBatchSafely(ops, pendingNewInBatch);
                        ops.clear();
                        pendingNewInBatch = 0;
                    }

                    JSObject ret = new JSObject();
                    ret.put("totalReceived", items.length());
                    ret.put("added", addedCount);
                    ret.put("updated", updatedCount);
                    ret.put("existingCount", existingPhoneToRawId.size());
                    ret.put("gmailCleaned", cleanedCount);
                    ret.put("groupId", groupId);
                    ret.put("accountUsed", (targetAccountName != null ? targetAccountName : "Local Device") + " (" + (targetAccountType != null ? targetAccountType : "local") + ")");
                    if (mLastBatchError != null) {
                        ret.put("lastError", mLastBatchError);
                    }
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
