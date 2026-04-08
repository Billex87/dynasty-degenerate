CREATE TABLE `leagueAnalysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leagueId` varchar(64) NOT NULL,
	`leagueName` text,
	`analysisData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leagueAnalysis_id` PRIMARY KEY(`id`),
	CONSTRAINT `leagueAnalysis_leagueId_unique` UNIQUE(`leagueId`)
);
