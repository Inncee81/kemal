package com.syntax.class06;

import java.util.Scanner;

public class ScannerAndLogicalOperators {
	public static void main(String[] args) {
		/*take age from a user and then based on the age,print output
		 * if age is from0-3 you are a baby
		 * if age is from 4-5 you are a kid
		 * if age is from 6-12 you are a child
		 * if age is from 13-19 you are a teenager
		 * if age is from 20-54 you are an adult
		 * if age is more or equals to 65  you are a senior
		 */
		//1- lets declare all variables
		int age;
		Scanner life;//to import scanner we use; ctrl+shift+o(for mac)
		//2. capture values
		 life=new Scanner(System.in);
		System.out.println("please enter your age");
	  age=life.nextInt();
	  //3. perform varifications;
	  
	  if(age>0) {
	  if(age<3) {System.out.println("you are a baby");
	  
	}else if(age>=3&&age<=5){
	  System.out.println("you are a kid");
	}else if(age>=6&&age<=12) {
		  System.out.println("you are a child");
	}else if(age>=13&&age<=19) {
		System.out.println("you are a teenager");
	}else if(age>=20&&age<=65){
		System.out.println("you are an adult");
	}else { 
		System.out.println("you are enjoying your life");
	
	} 
	}else {
		System.out.println("please enter valid age");
	}
}	
}	


