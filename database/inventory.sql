-- Restart-safe migration: initialization runs only when adding remaining_quantity.
SET @stock_new = (SELECT COUNT(*)=0 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='daily_menu_items' AND column_name='remaining_quantity');
SET @ddl = IF(@stock_new,'ALTER TABLE daily_menu_items ADD COLUMN remaining_quantity INT NOT NULL DEFAULT 50','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='orders' AND column_name='stock_deducted')=0,'ALTER TABLE orders ADD COLUMN stock_deducted BOOLEAN NOT NULL DEFAULT FALSE','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE daily_menu_items m LEFT JOIN (
 SELECT o.delivery_date,i.dish_id,SUM(i.quantity) AS used FROM orders o JOIN order_items i ON i.order_id=o.id
 WHERE o.status IN ('Pending','Confirmed','Completed') GROUP BY o.delivery_date,i.dish_id
) consumed ON consumed.delivery_date=m.menu_date AND consumed.dish_id=m.dish_id
SET m.supply_quantity=GREATEST(m.supply_quantity,COALESCE(consumed.used,0)),m.remaining_quantity=GREATEST(0,m.supply_quantity-COALESCE(consumed.used,0)) WHERE @stock_new;
UPDATE orders SET stock_deducted=TRUE WHERE @stock_new AND status IN ('Pending','Confirmed','Completed');
