package com.syntax.class01;

import java.util.Scanner;

public class Myclass {
public static void main(String[] args) {
	Scanner scan=new Scanner(System.in);

	int num[]=new int[5];
    for(int i=0;i<5;i++) {
 	  
	num[i]=scan.nextInt(); 
    }for(int j=0;j<num.length;j++) {
 	   System.out.println(num[j]);
    }   
    }
}