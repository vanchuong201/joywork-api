-- Public verification URLs must not remain readable. The object key stays for signed downloads.
UPDATE "companies" SET "verificationFileUrl" = NULL WHERE "verificationFileUrl" IS NOT NULL;
