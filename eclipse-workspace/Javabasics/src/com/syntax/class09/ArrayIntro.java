package com.syntax.class09;

public class ArrayIntro {

	public static void main(String[] args) {
	//declare an array and initialize it and store values
		int[]array=new int[4];array[0]=10;
		array[0]=10;
		array[1]=20;
		array[2]=30;
		array[3]=40;
        //how do we access elements from an array
		System.out.println(array[1]);
	//second way to create and array
		String[]carArray;
		carArray=new String[3];
		carArray[0]="BMW";
		carArray[1]="Honda";
		carArray[2]="Toyota";
		//I am driving a Toyota
		System.out.println("==========================");
		System.out.println("I am driving a "+carArray[2]);
		
		int[] numbers=new int[3];
		numbers[0]=100;
		numbers[1]=200;
		numbers[2]=300;
		// if we want to change the value of the numbers. for example[1];
		numbers[1]=2000;
		System.out.println(numbers[1]);// we reassigned index [1] value from 200 to 2000
	}

}
