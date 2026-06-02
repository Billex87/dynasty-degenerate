CREATE TABLE IF NOT EXISTS `magicLinkTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenId` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`purpose` varchar(32) NOT NULL DEFAULT 'login',
	`redirectPath` text,
	`ipAddress` text,
	`userAgent` text,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `magicLinkTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `magicLinkTokens_tokenId_unique` UNIQUE(`tokenId`),
	CONSTRAINT `magicLinkTokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
CREATE INDEX `magicLinkTokens_email_createdAt_idx` ON `magicLinkTokens` (`email`,`createdAt`);
CREATE INDEX `magicLinkTokens_expiresAt_idx` ON `magicLinkTokens` (`expiresAt`);
CREATE INDEX `magicLinkTokens_token_hash_idx` ON `magicLinkTokens` (`tokenHash`);
