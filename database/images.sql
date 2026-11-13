-- Correct bootstrap images only; preserve any customized image URL.
UPDATE dishes SET image_url='' WHERE id=1 AND image_url='/product-images/image_01_s-1770018186746.jpg';
UPDATE dishes SET image_url='/product-images/image_12_s-1712826759815.jpg' WHERE id=2 AND image_url='/product-images/image_02_s-1770018009551.jpg';
UPDATE dishes SET image_url='' WHERE id=3 AND image_url='/product-images/image_03_s-1770692954543.jpg';
UPDATE dishes SET image_url='' WHERE id=4 AND image_url='/product-images/image_04_s-1770692909319.jpg';
UPDATE dishes SET image_url='' WHERE id=5 AND image_url='/product-images/image_05_s-1754039039182.jpg';
UPDATE dishes SET image_url='/product-images/image_06_s-1743568100509.jpg' WHERE id=6 AND image_url='/product-images/image_06_s-1743568100509.jpg';
UPDATE dishes SET image_url='' WHERE id=7 AND image_url='/product-images/image_07_s-1704480348317.jpg';
UPDATE dishes SET image_url='/product-images/image_18_s-1743568146623.jpg' WHERE id=8 AND image_url='/product-images/image_08_s-1716432256417.jpg';
UPDATE dishes SET image_url='' WHERE id=9 AND image_url='/product-images/image_09_s-1714595571538.jpg';
