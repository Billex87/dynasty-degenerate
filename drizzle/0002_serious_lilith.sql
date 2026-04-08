CREATE TABLE `ktcSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` timestamp NOT NULL,
	`ktcData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ktcSnapshots_id` PRIMARY KEY(`id`)
);
