CREATE TABLE IF NOT EXISTS `userSleeperAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`sleeperUserId` varchar(64) NOT NULL,
	`sleeperUsername` varchar(64) NOT NULL,
	`displayName` text,
	`avatar` text,
	`isPrimary` int NOT NULL DEFAULT 0,
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSleeperAccounts_id` PRIMARY KEY(`id`)
);
CREATE UNIQUE INDEX `userSleeperAccounts_user_sleeper_uidx` ON `userSleeperAccounts` (`userOpenId`,`sleeperUserId`);
CREATE INDEX `userSleeperAccounts_user_username_idx` ON `userSleeperAccounts` (`userOpenId`,`sleeperUsername`);

CREATE TABLE IF NOT EXISTS `userFavoriteLeagues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`leagueId` varchar(64) NOT NULL,
	`leagueName` text,
	`platform` varchar(32) NOT NULL DEFAULT 'sleeper',
	`sleeperUserId` varchar(64),
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userFavoriteLeagues_id` PRIMARY KEY(`id`)
);
CREATE UNIQUE INDEX `userFavoriteLeagues_user_league_uidx` ON `userFavoriteLeagues` (`userOpenId`,`leagueId`);
CREATE INDEX `userFavoriteLeagues_user_updatedAt_idx` ON `userFavoriteLeagues` (`userOpenId`,`updatedAt`);

CREATE TABLE IF NOT EXISTS `userRecentReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`leagueId` varchar(64) NOT NULL,
	`leagueName` text,
	`sleeperUsername` varchar(64),
	`sleeperUserId` varchar(64),
	`platform` varchar(32) NOT NULL DEFAULT 'sleeper',
	`metadata` longtext,
	`lastViewedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userRecentReports_id` PRIMARY KEY(`id`)
);
CREATE UNIQUE INDEX `userRecentReports_user_league_uidx` ON `userRecentReports` (`userOpenId`,`leagueId`);
CREATE INDEX `userRecentReports_user_viewed_idx` ON `userRecentReports` (`userOpenId`,`lastViewedAt`);

CREATE TABLE IF NOT EXISTS `userNotificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`billingEmails` int NOT NULL DEFAULT 1,
	`productEmails` int NOT NULL DEFAULT 1,
	`reportAlerts` int NOT NULL DEFAULT 0,
	`anomalyAlerts` int NOT NULL DEFAULT 0,
	`weeklyDigest` int NOT NULL DEFAULT 0,
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userNotificationPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `userNotificationPreferences_userOpenId_unique` UNIQUE(`userOpenId`)
);
CREATE INDEX `userNotificationPreferences_user_open_id_idx` ON `userNotificationPreferences` (`userOpenId`);
