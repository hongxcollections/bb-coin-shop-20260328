CREATE TABLE `merchantApplications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `merchantName` varchar(100) NOT NULL,
  `selfIntro` text NOT NULL,
  `whatsapp` varchar(30) NOT NULL,
  `yearsExperience` varchar(20) NOT NULL,
  `categories` text NOT NULL,
  `samplePhotos` text NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `adminNote` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `merchantApplications_id` PRIMARY KEY(`id`)
);
