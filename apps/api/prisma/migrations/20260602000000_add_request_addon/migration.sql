-- Per-request add-on flag. True when a request was submitted as a paid
-- over-limit add-on ($25, invoiced separately by BDT). Existing rows default
-- to false (within-plan).
ALTER TABLE "requests" ADD COLUMN "add_on" BOOLEAN NOT NULL DEFAULT false;
