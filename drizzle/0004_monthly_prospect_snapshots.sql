CREATE TABLE IF NOT EXISTS `prospectSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(64) NOT NULL,
	`snapshotMonth` varchar(7) NOT NULL,
	`prospectData` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prospectSnapshots_id` PRIMARY KEY(`id`)
);
CREATE UNIQUE INDEX `prospectSnapshots_source_month_uidx` ON `prospectSnapshots` (`source`,`snapshotMonth`);
CREATE INDEX `prospectSnapshots_source_month_idx` ON `prospectSnapshots` (`source`,`snapshotMonth`);
