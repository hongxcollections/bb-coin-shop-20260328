-- Safe migration: add isBanned column to users table
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `isBanned` int NOT NULL DEFAULT 0;
