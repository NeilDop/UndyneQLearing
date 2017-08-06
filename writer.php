<?php
$learnRate = $_POST['lr'];
$discount = $_POST['discount'];
if(isset($_POST['itter']))
{
	$txt = "" . $_POST['itter'] . "," . ($_POST['time']);
	$myfile = file_put_contents("Undyne_LR-$learnRate Discount-$discount.csv", $txt.PHP_EOL , FILE_APPEND | LOCK_EX);

	$txt = "" . $_POST['arrowDmg'] . "," . ($_POST['spearDmg']);
	$myfile = file_put_contents("Damage_LR-$learnRate Discount-$discount.csv", $txt.PHP_EOL , LOCK_EX);
}
	
if(isset($_POST['myData']))
{
	$txt = $_POST['myData'];
	$myfile = file_put_contents("QValues_LR-$learnRate Discount-$discount.json", $txt.PHP_EOL , LOCK_EX);
}


?>