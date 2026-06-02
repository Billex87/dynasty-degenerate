CREATE TABLE IF NOT EXISTS `billingCustomers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userOpenId` varchar(64) NOT NULL,
	`stripeCustomerId` varchar(128) NOT NULL,
	`email` varchar(320),
	`name` text,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingCustomers_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingCustomers_stripeCustomerId_unique` UNIQUE(`stripeCustomerId`)
);
CREATE INDEX `billingCustomers_user_open_id_idx` ON `billingCustomers` (`userOpenId`);

CREATE TABLE IF NOT EXISTS `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userOpenId` varchar(64) NOT NULL,
	`stripeCustomerId` varchar(128) NOT NULL,
	`stripeSubscriptionId` varchar(128) NOT NULL,
	`plan` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`priceId` varchar(128),
	`productId` varchar(128),
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`cancelAtPeriodEnd` int NOT NULL DEFAULT 0,
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`)
);
CREATE INDEX `subscriptions_user_status_idx` ON `subscriptions` (`userOpenId`,`status`);
CREATE INDEX `subscriptions_stripe_customer_idx` ON `subscriptions` (`stripeCustomerId`);

CREATE TABLE IF NOT EXISTS `leaguePasses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leagueId` varchar(64) NOT NULL,
	`purchaserUserId` int,
	`purchaserOpenId` varchar(64) NOT NULL,
	`stripeCustomerId` varchar(128),
	`stripeSubscriptionId` varchar(128),
	`stripeCheckoutSessionId` varchar(128),
	`status` varchar(32) NOT NULL,
	`startsAt` timestamp,
	`expiresAt` timestamp,
	`maxManagers` int,
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaguePasses_id` PRIMARY KEY(`id`)
);
CREATE INDEX `leaguePasses_league_status_idx` ON `leaguePasses` (`leagueId`,`status`);
CREATE INDEX `leaguePasses_purchaser_idx` ON `leaguePasses` (`purchaserOpenId`);
CREATE INDEX `leaguePasses_stripe_checkout_idx` ON `leaguePasses` (`stripeCheckoutSessionId`);

CREATE TABLE IF NOT EXISTS `featureEntitlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectType` varchar(16) NOT NULL,
	`userOpenId` varchar(64),
	`leagueId` varchar(64),
	`featureKey` varchar(64) NOT NULL,
	`plan` varchar(32),
	`source` varchar(32) NOT NULL,
	`sourceId` varchar(128),
	`status` varchar(32) NOT NULL,
	`startsAt` timestamp,
	`expiresAt` timestamp,
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `featureEntitlements_id` PRIMARY KEY(`id`)
);
CREATE INDEX `featureEntitlements_user_feature_idx` ON `featureEntitlements` (`userOpenId`,`featureKey`,`status`);
CREATE INDEX `featureEntitlements_league_feature_idx` ON `featureEntitlements` (`leagueId`,`featureKey`,`status`);
CREATE INDEX `featureEntitlements_source_idx` ON `featureEntitlements` (`source`,`sourceId`);

CREATE TABLE IF NOT EXISTS `usageEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`userOpenId` varchar(64),
	`leagueId` varchar(64),
	`featureKey` varchar(64) NOT NULL,
	`usageKey` varchar(64) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`source` varchar(32) NOT NULL,
	`metadata` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usageEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `usageEvents_eventId_unique` UNIQUE(`eventId`)
);
CREATE INDEX `usageEvents_user_feature_createdAt_idx` ON `usageEvents` (`userOpenId`,`featureKey`,`createdAt`);
CREATE INDEX `usageEvents_league_feature_createdAt_idx` ON `usageEvents` (`leagueId`,`featureKey`,`createdAt`);
CREATE INDEX `usageEvents_feature_usage_key_idx` ON `usageEvents` (`featureKey`,`usageKey`);
