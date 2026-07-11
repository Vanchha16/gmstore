-- GM Store Database Backup Dump
-- Generated on 2026-07-10T11:49:03.175003

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------
-- Table structure for table `categories`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `slug` varchar(120) NOT NULL,
  `icon_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `categories`
INSERT INTO `categories` (`id`, `name`, `slug`, `icon_url`) VALUES (1, 'PUBG Mobile', 'pubg-mobile', NULL);
INSERT INTO `categories` (`id`, `name`, `slug`, `icon_url`) VALUES (2, 'Verification Category', 'verification-cat', NULL);

-- ------------------------------------------------------
-- Table structure for table `users`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `role` enum('customer','admin') NOT NULL,
  `is_verified` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `users`
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `avatar_url`, `role`, `is_verified`, `created_at`, `updated_at`) VALUES (1, 'test@example.com', '$2b$12$Gi6YHP7BqLoZVhjhINrbD.h2XFiJzJstv9.6f1qA0jlSZ1V0Ugb0q', 'Test User', NULL, NULL, 'admin', 1, '2026-07-10T03:47:29', '2026-07-10T04:39:46');
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `avatar_url`, `role`, `is_verified`, `created_at`, `updated_at`) VALUES (2, 'loumvanchha@gmail.com', '$2b$12$DVeVi3fwmqrH2TZsdMTYm.glT609Y6Tpk7kKQ8Q.soDlty3p0yvqO', 'test', NULL, NULL, 'customer', 0, '2026-07-10T04:08:27', '2026-07-10T04:08:27');
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `avatar_url`, `role`, `is_verified`, `created_at`, `updated_at`) VALUES (3, 'test_verification@gmstore.local', '$2b$12$dummyhashdummyhashdummyhashdummyhashdummyhash', 'Verification Tester', NULL, NULL, 'customer', 1, '2026-07-10T04:16:09', '2026-07-10T04:16:09');
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `avatar_url`, `role`, `is_verified`, `created_at`, `updated_at`) VALUES (5, 'test_transaction@gmstore.local', '$2b$12$dummyhashdummyhashdummyhashdummyhashdummyhash', 'Transaction Tester', NULL, NULL, 'customer', 1, '2026-07-10T04:25:45', '2026-07-10T04:25:45');
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `avatar_url`, `role`, `is_verified`, `created_at`, `updated_at`) VALUES (6, 'verify_final@gmstore.local', '$2b$12$0QBsme0SpQuIDoIfJVtQ1ulcn745uDlxF4Bsnnnm1pwh7cPySGVY2', 'Final Tester', NULL, NULL, 'customer', 0, '2026-07-10T04:37:07', '2026-07-10T04:37:07');
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone`, `avatar_url`, `role`, `is_verified`, `created_at`, `updated_at`) VALUES (7, 'chha3138@gmail.com', '$2b$12$y7npR3niRv49cmrVg7dSpezPhscxgv5bz9vgOmDnFOM8NyywXpxjW', 'chha', NULL, NULL, 'customer', 1, '2026-07-10T04:40:08', '2026-07-10T04:40:12');

-- ------------------------------------------------------
-- Table structure for table `products`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `slug` varchar(220) NOT NULL,
  `description` text,
  `product_type` enum('account','game_key') NOT NULL,
  `category_id` bigint DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `compare_at_price` decimal(10,2) DEFAULT NULL,
  `currency` varchar(3) NOT NULL,
  `status` enum('draft','coming_soon','active','archived') NOT NULL,
  `release_date` datetime DEFAULT NULL,
  `is_featured` tinyint(1) NOT NULL,
  `sold_count` int NOT NULL,
  `rating_avg` decimal(3,2) NOT NULL,
  `rating_count` int NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `category_id` (`category_id`),
  KEY `idx_product_slug_status` (`slug`,`status`),
  KEY `idx_product_category` (`category_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `products`
INSERT INTO `products` (`id`, `title`, `slug`, `description`, `product_type`, `category_id`, `price`, `compare_at_price`, `currency`, `status`, `release_date`, `is_featured`, `sold_count`, `rating_avg`, `rating_count`, `created_at`, `updated_at`, `deleted_at`) VALUES (1, 'PUBG Starter Account', 'pubg-starter-account', '', 'account', NULL, 9.99, NULL, 'USD', 'active', NULL, 1, 0, 0.00, 0, '2026-07-10T03:55:22', '2026-07-10T03:55:22', NULL);
INSERT INTO `products` (`id`, `title`, `slug`, `description`, `product_type`, `category_id`, `price`, `compare_at_price`, `currency`, `status`, `release_date`, `is_featured`, `sold_count`, `rating_avg`, `rating_count`, `created_at`, `updated_at`, `deleted_at`) VALUES (2, 'Active Verification Game', 'test-active-game', 'An active game for testing reviews and favorites.', 'game_key', 2, 29.99, NULL, 'USD', 'active', NULL, 0, 0, 4.50, 2, '2026-07-10T04:16:09', '2026-07-10T04:16:09', NULL);
INSERT INTO `products` (`id`, `title`, `slug`, `description`, `product_type`, `category_id`, `price`, `compare_at_price`, `currency`, `status`, `release_date`, `is_featured`, `sold_count`, `rating_avg`, `rating_count`, `created_at`, `updated_at`, `deleted_at`) VALUES (3, 'Coming Soon Verification Game', 'test-coming-soon-game', 'A coming soon game for testing preorders.', 'account', 2, 59.99, NULL, 'USD', 'coming_soon', NULL, 0, 0, 0.00, 0, '2026-07-10T04:16:09', '2026-07-10T04:16:09', NULL);
INSERT INTO `products` (`id`, `title`, `slug`, `description`, `product_type`, `category_id`, `price`, `compare_at_price`, `currency`, `status`, `release_date`, `is_featured`, `sold_count`, `rating_avg`, `rating_count`, `created_at`, `updated_at`, `deleted_at`) VALUES (4, 'Transaction Test Game', 'tx-test-product', 'Game for testing checkout locking and delivery.', 'game_key', NULL, 19.99, NULL, 'USD', 'active', NULL, 0, 3, 0.00, 0, '2026-07-10T04:25:45', '2026-07-10T04:40:28', NULL);
INSERT INTO `products` (`id`, `title`, `slug`, `description`, `product_type`, `category_id`, `price`, `compare_at_price`, `currency`, `status`, `release_date`, `is_featured`, `sold_count`, `rating_avg`, `rating_count`, `created_at`, `updated_at`, `deleted_at`) VALUES (5, 'Final Test Game', 'final-test-product', 'Testing callback webhooks.', 'game_key', NULL, 29.99, NULL, 'USD', 'active', NULL, 0, 1, 0.00, 0, '2026-07-10T04:37:10', '2026-07-10T04:37:10', NULL);

-- ------------------------------------------------------
-- Table structure for table `orders`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_number` varchar(30) NOT NULL,
  `user_id` bigint NOT NULL,
  `status` enum('pending_payment','paid','fulfilled','cancelled','refunded','failed') NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL,
  `is_preorder` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `fulfilled_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `orders`
INSERT INTO `orders` (`id`, `order_number`, `user_id`, `status`, `subtotal`, `discount`, `total`, `currency`, `is_preorder`, `created_at`, `paid_at`, `fulfilled_at`) VALUES (1, 'GM-20260710-928812', 5, 'fulfilled', 39.98, 0.00, 39.98, 'USD', 0, '2026-07-10T04:25:45', '2026-07-10T04:25:45', '2026-07-10T04:25:45');
INSERT INTO `orders` (`id`, `order_number`, `user_id`, `status`, `subtotal`, `discount`, `total`, `currency`, `is_preorder`, `created_at`, `paid_at`, `fulfilled_at`) VALUES (2, 'GM-20260710-159641', 5, 'pending_payment', 19.99, 0.00, 19.99, 'USD', 0, '2026-07-10T04:25:45', NULL, NULL);
INSERT INTO `orders` (`id`, `order_number`, `user_id`, `status`, `subtotal`, `discount`, `total`, `currency`, `is_preorder`, `created_at`, `paid_at`, `fulfilled_at`) VALUES (3, 'GM-20260710-485696', 5, 'cancelled', 19.99, 0.00, 19.99, 'USD', 0, '2026-07-10T04:25:48', NULL, NULL);
INSERT INTO `orders` (`id`, `order_number`, `user_id`, `status`, `subtotal`, `discount`, `total`, `currency`, `is_preorder`, `created_at`, `paid_at`, `fulfilled_at`) VALUES (4, 'GM-20260710-896631', 6, 'fulfilled', 29.99, 0.00, 29.99, 'USD', 0, '2026-07-10T04:37:10', '2026-07-10T04:37:10', '2026-07-10T04:37:10');
INSERT INTO `orders` (`id`, `order_number`, `user_id`, `status`, `subtotal`, `discount`, `total`, `currency`, `is_preorder`, `created_at`, `paid_at`, `fulfilled_at`) VALUES (5, 'GM-20260710-647252', 7, 'fulfilled', 19.99, 0.00, 19.99, 'USD', 0, '2026-07-10T04:40:24', '2026-07-10T04:40:28', '2026-07-10T04:40:28');

-- ------------------------------------------------------
-- Table structure for table `carts`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `carts`;
CREATE TABLE `carts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `status` enum('active','converted','abandoned') NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `carts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `carts`
INSERT INTO `carts` (`id`, `user_id`, `status`, `created_at`) VALUES (1, 5, 'converted', '2026-07-10T04:25:45');
INSERT INTO `carts` (`id`, `user_id`, `status`, `created_at`) VALUES (3, 5, 'converted', '2026-07-10T04:25:48');
INSERT INTO `carts` (`id`, `user_id`, `status`, `created_at`) VALUES (4, 6, 'converted', '2026-07-10T04:37:10');
INSERT INTO `carts` (`id`, `user_id`, `status`, `created_at`) VALUES (5, 7, 'converted', '2026-07-10T04:40:12');
INSERT INTO `carts` (`id`, `user_id`, `status`, `created_at`) VALUES (6, 1, 'active', '2026-07-10T04:40:59');

-- ------------------------------------------------------
-- Table structure for table `otp_codes`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `otp_codes`;
CREATE TABLE `otp_codes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `purpose` enum('register','reset_password') NOT NULL,
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `attempts` int NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `otp_codes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `otp_codes`
INSERT INTO `otp_codes` (`id`, `user_id`, `code_hash`, `purpose`, `expires_at`, `consumed_at`, `attempts`, `created_at`) VALUES (1, 1, '$2b$12$tnYDslSatCABUYQsc4i3MuBrRkGRyDa3.tQzPKw5tNCqz/xoktaLW', 'register', '2026-07-10T03:57:29', NULL, 0, '2026-07-10T03:47:29');
INSERT INTO `otp_codes` (`id`, `user_id`, `code_hash`, `purpose`, `expires_at`, `consumed_at`, `attempts`, `created_at`) VALUES (2, 1, '$2b$12$3Fk9n6LCq24cttF6RlatJuRVuzkpI9fhgYT05n1GNUQUb1R9Fx.ze', 'register', '2026-07-10T03:57:57', '2026-07-10T03:48:04', 0, '2026-07-10T03:47:57');
INSERT INTO `otp_codes` (`id`, `user_id`, `code_hash`, `purpose`, `expires_at`, `consumed_at`, `attempts`, `created_at`) VALUES (3, 2, '$2b$12$LwMj86fD9Y.K5oOFb9mou.4CDHuk2I.BjEMgrcL.9Dhec18009mSa', 'register', '2026-07-10T04:18:27', NULL, 2, '2026-07-10T04:08:27');
INSERT INTO `otp_codes` (`id`, `user_id`, `code_hash`, `purpose`, `expires_at`, `consumed_at`, `attempts`, `created_at`) VALUES (4, 6, '$2b$12$aO8lVSeng93.bZXpwFQDHOrHTbslD0vAoYPtmSBAaQoQ3iwzcSV6S', 'register', '2026-07-10T04:47:08', NULL, 0, '2026-07-10T04:37:08');
INSERT INTO `otp_codes` (`id`, `user_id`, `code_hash`, `purpose`, `expires_at`, `consumed_at`, `attempts`, `created_at`) VALUES (5, 7, '$2b$12$HpkPfwLJWhCHrs.XbdRcqeLB2odEZAKIUtDKvhXgaEDN8PVY.oklK', 'register', '2026-07-10T04:50:08', '2026-07-10T04:40:12', 0, '2026-07-10T04:40:08');

-- ------------------------------------------------------
-- Table structure for table `contact_messages`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `contact_messages`;
CREATE TABLE `contact_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `subject` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `contact_messages`
INSERT INTO `contact_messages` (`id`, `name`, `email`, `subject`, `message`, `created_at`) VALUES (1, 'Verification Tester', 'verify_phase5@gmstore.local', 'Integration Test', 'Running automated integration test for Phase 5 verification.', '2026-07-10T04:31:24');

-- ------------------------------------------------------
-- Table structure for table `stock_items`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `stock_items`;
CREATE TABLE `stock_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL,
  `secret_payload` text NOT NULL,
  `status` enum('available','reserved','sold') NOT NULL,
  `order_id` bigint DEFAULT NULL,
  `reserved_until` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `order_id` (`order_id`),
  KEY `idx_stock_product_status` (`product_id`,`status`),
  CONSTRAINT `stock_items_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `stock_items_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `stock_items`
INSERT INTO `stock_items` (`id`, `product_id`, `secret_payload`, `status`, `order_id`, `reserved_until`, `created_at`) VALUES (1, 1, 'gAAAAABqUG1dvd6RY0hI2jJ_oQUYyUkNyGUqfB3hr49DjRBvZUdJvBuNL7-wtO2cFeRPlp2h9EZ8_LlZmHbVzBjq0msCQnxOUw==', 'available', NULL, NULL, '2026-07-10T03:56:14');
INSERT INTO `stock_items` (`id`, `product_id`, `secret_payload`, `status`, `order_id`, `reserved_until`, `created_at`) VALUES (2, 1, 'gAAAAABqUG1dWDTTV-vFJu2wbmgtMOKbaFQdagX75VKESxiUrfHR7XVW0uztczIHPynUkhxSIDwuCcHhWOzCMxsCpw4PBSmKpw==', 'available', NULL, NULL, '2026-07-10T03:56:14');
INSERT INTO `stock_items` (`id`, `product_id`, `secret_payload`, `status`, `order_id`, `reserved_until`, `created_at`) VALUES (3, 1, 'gAAAAABqUG1dk8_nPhOUdvRSE_iHPgAKNEixDDlQAxbDiv5dkv4IVgmTmdHFzNOZIbALIuOHiUDUh7Peq17MsQDLzsnHUiZV3w==', 'available', NULL, NULL, '2026-07-10T03:56:14');
INSERT INTO `stock_items` (`id`, `product_id`, `secret_payload`, `status`, `order_id`, `reserved_until`, `created_at`) VALUES (4, 4, 'gAAAAABqUHRJ9eamqbXwK76dsQ7t9iCrE-aNGoe-QQWUAaTooc37Y4ZYsoTf41vzXz1cNHQDmc5npxUiWruulykJeb_M2WzDwg==', 'sold', 1, NULL, '2026-07-10T04:25:45');
INSERT INTO `stock_items` (`id`, `product_id`, `secret_payload`, `status`, `order_id`, `reserved_until`, `created_at`) VALUES (5, 4, 'gAAAAABqUHRJTO_2y2WvGu1B5Z9oxEe2E7t_EXdDCdzf26aJxrGRq9D1gDLq2ev-e336d_llXBEpFzHHKtOy6wCZr2KhB2A8Fw==', 'sold', 1, NULL, '2026-07-10T04:25:45');
INSERT INTO `stock_items` (`id`, `product_id`, `secret_payload`, `status`, `order_id`, `reserved_until`, `created_at`) VALUES (6, 4, 'gAAAAABqUHRLFP8sdRRDh9z8ZW1Cqe3GQkD6IjweLiUJl7Po0rMLTRTOAmPcPU0nm3qlHg1c27Z3TIHNM_rJej3TbxHpv4pA-w==', 'sold', 5, NULL, '2026-07-10T04:25:48');
INSERT INTO `stock_items` (`id`, `product_id`, `secret_payload`, `status`, `order_id`, `reserved_until`, `created_at`) VALUES (7, 5, 'gAAAAABqUHb1pXL9Y6sHtAwLoIZjDHlfTmq5xmodlNFYH8bDmiAxZmE-DKpwioUErLAT0q6w9lCCd0vO8asI0TIzs-7TiuRu2xWuQ57C8VlltjNwxV5tegc=', 'sold', 4, NULL, '2026-07-10T04:37:10');

-- ------------------------------------------------------
-- Table structure for table `favorites`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `favorites`;
CREATE TABLE `favorites` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_product_favorite` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `favorites_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `favorites`
INSERT INTO `favorites` (`id`, `user_id`, `product_id`, `created_at`) VALUES (1, 3, 2, '2026-07-10T04:16:09');
INSERT INTO `favorites` (`id`, `user_id`, `product_id`, `created_at`) VALUES (2, 1, 1, '2026-07-10T04:42:13');

-- ------------------------------------------------------
-- Table structure for table `reviews`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `reviews`;
CREATE TABLE `reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `rating` int NOT NULL,
  `comment` text,
  `is_verified_purchase` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_user_review` (`product_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `reviews`
INSERT INTO `reviews` (`id`, `product_id`, `user_id`, `rating`, `comment`, `is_verified_purchase`, `created_at`) VALUES (1, 2, 3, 5, 'Incredible gameplay and fast delivery!', 1, '2026-07-10T04:16:09');

-- ------------------------------------------------------
-- Table structure for table `preorders`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `preorders`;
CREATE TABLE `preorders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `status` enum('waiting','notified','converted','cancelled') NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_product_preorder` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `preorders_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `preorders_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `preorders`
INSERT INTO `preorders` (`id`, `user_id`, `product_id`, `status`, `created_at`) VALUES (1, 3, 3, 'waiting', '2026-07-10T04:16:09');

-- ------------------------------------------------------
-- Table structure for table `cart_items`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `cart_items`;
CREATE TABLE `cart_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cart_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `qty` int NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `cart_id` (`cart_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `cart_items_ibfk_1` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cart_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `cart_items`
INSERT INTO `cart_items` (`id`, `cart_id`, `product_id`, `unit_price`, `qty`, `created_at`) VALUES (1, 1, 4, 19.99, 2, '2026-07-10T04:25:45');
INSERT INTO `cart_items` (`id`, `cart_id`, `product_id`, `unit_price`, `qty`, `created_at`) VALUES (3, 3, 4, 19.99, 1, '2026-07-10T04:25:48');
INSERT INTO `cart_items` (`id`, `cart_id`, `product_id`, `unit_price`, `qty`, `created_at`) VALUES (4, 4, 5, 29.99, 1, '2026-07-10T04:37:10');
INSERT INTO `cart_items` (`id`, `cart_id`, `product_id`, `unit_price`, `qty`, `created_at`) VALUES (5, 5, 4, 19.99, 1, '2026-07-10T04:40:19');

-- ------------------------------------------------------
-- Table structure for table `order_items`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `title_snapshot` varchar(200) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `qty` int NOT NULL,
  `stock_item_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `product_id` (`product_id`),
  KEY `stock_item_id` (`stock_item_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `order_items_ibfk_3` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `order_items`
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `title_snapshot`, `unit_price`, `qty`, `stock_item_id`) VALUES (1, 1, 4, 'Transaction Test Game', 19.99, 1, 4);
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `title_snapshot`, `unit_price`, `qty`, `stock_item_id`) VALUES (2, 1, 4, 'Transaction Test Game', 19.99, 1, 5);
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `title_snapshot`, `unit_price`, `qty`, `stock_item_id`) VALUES (3, 3, 4, 'Transaction Test Game', 19.99, 1, 6);
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `title_snapshot`, `unit_price`, `qty`, `stock_item_id`) VALUES (4, 4, 5, 'Final Test Game', 29.99, 1, 7);
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `title_snapshot`, `unit_price`, `qty`, `stock_item_id`) VALUES (5, 5, 4, 'Transaction Test Game', 19.99, 1, 6);

-- ------------------------------------------------------
-- Table structure for table `payments`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `provider` enum('payway','mock') NOT NULL,
  `method` enum('khqr','card','abapay') NOT NULL,
  `provider_txn_id` varchar(100) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('created','pending','success','failed','refunded') NOT NULL,
  `raw_response` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Dumping data for table `payments`
INSERT INTO `payments` (`id`, `order_id`, `provider`, `method`, `provider_txn_id`, `amount`, `status`, `raw_response`, `created_at`, `updated_at`) VALUES (1, 1, 'mock', 'khqr', 'TEST-TXN-9999', 39.98, 'success', '{"test": "webhook"}', '2026-07-10T04:25:45', '2026-07-10T04:25:45');
INSERT INTO `payments` (`id`, `order_id`, `provider`, `method`, `provider_txn_id`, `amount`, `status`, `raw_response`, `created_at`, `updated_at`) VALUES (2, 3, 'mock', 'khqr', NULL, 19.99, 'created', NULL, '2026-07-10T04:25:48', '2026-07-10T04:25:48');
INSERT INTO `payments` (`id`, `order_id`, `provider`, `method`, `provider_txn_id`, `amount`, `status`, `raw_response`, `created_at`, `updated_at`) VALUES (3, 4, 'mock', 'khqr', 'FINAL-APROV-7777', 29.99, 'success', '{"hash": "mock_signature_is_validated_as_true_in_mock_mode", "amount": "29.99", "status": "0", "tran_id": "GM-20260710-896631", "aprov_code": "FINAL-APROV-7777"}', '2026-07-10T04:37:10', '2026-07-10T04:37:10');
INSERT INTO `payments` (`id`, `order_id`, `provider`, `method`, `provider_txn_id`, `amount`, `status`, `raw_response`, `created_at`, `updated_at`) VALUES (4, 5, 'mock', 'khqr', 'MOCK-TXN-22169690', 19.99, 'success', '{"simulation": "success"}', '2026-07-10T04:40:24', '2026-07-10T04:40:28');

-- ------------------------------------------------------
-- Table structure for table `alembic_version`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `alembic_version`;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `alembic_version`
INSERT INTO `alembic_version` (`version_num`) VALUES ('f7dd45156a44');

-- ------------------------------------------------------
-- Table structure for table `product_images`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `product_images`;
CREATE TABLE `product_images` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL,
  `url` varchar(500) NOT NULL,
  `sort_order` int NOT NULL,
  `is_primary` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_images_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

SET FOREIGN_KEY_CHECKS = 1;